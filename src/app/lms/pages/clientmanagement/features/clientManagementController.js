const mongoose = require("mongoose");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const ClientManagement = require("../models/ClientManagementModel");
const {
  nextClientCode,
  parseClientCode,
  ensureClientCounterAtLeast,
} = require("../utils/clientCode");
const { pocClientFilter, scopeHasClient } = require("../utils/pocScope");

// Cloudinary — client logos are stored under the "lms/client-logos/<institution>"
// folder so each tenant's assets are grouped, and a delete-old cleanup can
// filter by that prefix later. The config is read at module load; if the env
// vars are missing, upload calls fail with a clear "not configured" error
// instead of silently going nowhere.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The business models a client can be engaged under (mirrors the frontend list).
// CSR is NOT a business model — it's a service model under B2B.
const BUSINESS_MODELS = ["B2B", "B2I", "B2C"];

// ── Client ID allocation ─────────────────────────────────────────────────────
// The next Client ID is minted by `nextClientCode` (utils/clientCode.js) with a
// single atomic $inc — so two parallel Add Client requests can never receive the
// same id even under load. Deleting a client does NOT roll the counter back:
// Client IDs are stable identifiers, not seat counts.
//
// The retry loop below exists for a narrow case: a legacy record was assigned a
// clientId by the backfill routine while a create was in flight, and the two
// happened to land on the same number. The counter is bumped to at least the
// stored max before every allocation (see backfillClientIds), so this loop
// almost never fires — but if it does, the duplicate-key error is caught and
// the next number is requested. Anything else is a real error and re-thrown.
const MAX_ID_ATTEMPTS = 5;
const createClientWithId = async (institutionId, payload) => {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const clientId = await nextClientCode(institutionId);
    try {
      return await ClientManagement.create({ ...payload, clientId });
    } catch (err) {
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.clientId) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("Could not allocate a Client ID after several attempts");
};

// Lazy backfill: records saved before the clientId column existed carry "".
// A page that displays them without an id would ship the placeholder forever,
// so on read we allocate one in place. The counter is first raised past every
// stored id in the institution — otherwise the backfill and a fresh create can
// collide on CLT-000001. A per-record failure is logged and swallowed; the
// GET never fails just because a backfill did.
const backfillClientIds = async (institutionId, records) => {
  const missing = records.filter((r) => !r.clientId);
  if (!missing.length) return records;

  const stored = await ClientManagement.find(
    { institution: institutionId, clientId: { $exists: true, $ne: "" } },
    { clientId: 1 }
  ).lean();
  const maxStored = stored
    .map((r) => parseClientCode(r.clientId))
    .filter(Number.isFinite)
    .reduce((max, n) => (n > max ? n : max), 0);
  if (maxStored > 0) await ensureClientCounterAtLeast(institutionId, maxStored);

  const assigned = new Map();
  for (const record of missing) {
    try {
      const clientId = await nextClientCode(institutionId);
      await ClientManagement.updateOne(
        { _id: record._id, $or: [{ clientId: { $exists: false } }, { clientId: "" }] },
        { $set: { clientId } }
      );
      assigned.set(String(record._id), clientId);
    } catch (err) {
      console.warn("clientId backfill skipped", err.message);
    }
  }
  return records.map((r) => (assigned.has(String(r._id))
    ? { ...r, clientId: assigned.get(String(r._id)) }
    : r));
};

// ── Paginated client list ────────────────────────────────────────────────────
// A port of ClientManagementPage's own `filteredClients` / `sortedClients`
// memos, so a given filter set selects the rows it always did.
//
// The page compares with `localeCompare(undefined, { numeric: true,
// sensitivity: 'base' })`. 'base' ignores case AND accents, which is collation
// strength ONE — not the strength 2 used for the user directory, where the
// page lowercased first and accents still counted.
const CLIENT_COLLATION = { locale: "en", strength: 1, numericOrdering: true };

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `scopeMatch` is `{}` for every role except a POC, for whom it is
// `{ _id: { $in: [...] } }`. It is applied to the row filter AND to the facet
// counts below — the facets are computed over the whole institution, so
// omitting them there would leak the true client total even though the rows
// were scoped.
async function getClientsPaginated(req, res, institutionId, scopeMatch = {}) {
  const {
    page, limit, search, status, businessModel, type, since, until, sortKey, sortDir,
  } = req.query;

  const isExport = req.query.export === "1" || req.query.export === "true";
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(isExport ? 5000 : 200, Math.max(1, parseInt(limit, 10) || 10));

  const filter = { institution: institutionId, ...scopeMatch };
  if (status) filter.status = status;
  // Business model accepts either a single value ("B2B") or a JSON-encoded
  // array (["B2B","B2I"]) so the toolbar can offer a multi-select. Legacy
  // callers pass one value; the multi-select sends an array.
  if (businessModel) {
    let models = null;
    if (typeof businessModel === "string" && businessModel.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(businessModel);
        if (Array.isArray(parsed)) models = parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid business model selection" });
      }
    }
    if (models) {
      // Empty array reads as "no filter", matching what the multi-select means
      // by an empty box.
      if (models.length === 1) filter.businessModel = models[0];
      else if (models.length > 1) filter.businessModel = { $in: models };
    } else {
      filter.businessModel = businessModel;
    }
  }
  // An explicit pick of clients, from the toolbar's client filter. Ids only —
  // anything that is not a valid ObjectId is dropped rather than passed to
  // Mongo, which would throw on the cast and 500 the whole page.
  if (req.query.clients) {
    try {
      const ids = JSON.parse(req.query.clients);
      if (!Array.isArray(ids)) throw new Error("clients must be an array");
      const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
      if (valid.length !== ids.length) throw new Error("Invalid client id");
      // An empty list is "no filter", the same as sending nothing — it is what
      // the toolbar's multi-select holds before anyone touches it.
      if (valid.length) {
        filter._id = { $in: valid.map((id) => new mongoose.Types.ObjectId(String(id))) };
      }
    } catch {
      return res.status(400).json({ success: false, message: "Invalid client selection" });
    }
  }
  // `type` is an array on the document; an equality match on an array field
  // matches when ANY element equals — the same as the page's `.some()`.
  if (type) filter.type = type;
  // The cutoff is computed in the BROWSER (local-time "this year" etc.) and
  // sent as an absolute instant. `$gte` also excludes documents with no
  // createdAt, matching the page's `if (!created || created < cut)`.
  const sinceMs = Number(since);
  if (Number.isFinite(sinceMs) && sinceMs > 0) {
    filter.createdAt = { $gte: new Date(sinceMs) };
  }
  const untilMs = Number(until);
  if (Number.isFinite(untilMs) && untilMs > 0) {
    filter.createdAt = { ...filter.createdAt, $lt: new Date(untilMs) };
  }
  if (req.query.createdRanges) {
    try {
      const ranges = JSON.parse(req.query.createdRanges);
      if (
        !Array.isArray(ranges) ||
        ranges.length > 100 ||
        !ranges.length ||
        ranges.some((range) =>
          !range ||
          !Number.isFinite(range.since) ||
          !Number.isFinite(range.until) ||
          range.since >= range.until ||
          !Number.isFinite(new Date(range.since).getTime()) ||
          !Number.isFinite(new Date(range.until).getTime())
        )
      ) {
        throw new Error("Invalid date ranges");
      }
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: ranges.map((range) => ({
            createdAt: { $gte: new Date(range.since), $lt: new Date(range.until) },
          })),
        },
      ];
    } catch {
      return res.status(400).json({ success: false, message: "Invalid created-year selection" });
    }
  }

// Normalize the services array coming from the client — keep only entries with a
// service name, and coerce serviceModals into a clean string array.
const normalizeServices = (services) => {
  if (!Array.isArray(services)) return [];
  const cleanStrArray = (arr) =>
    Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];

  const str = (v) => (v ? String(v).trim() : "");

  const cleanDepartments = (departments) => {
    if (!Array.isArray(departments)) return [];
    return departments
      .map((d) => ({
        department: str(d && d.department),
        sections: cleanStrArray(d && d.sections),
        semesters: cleanStrArray(d && d.semesters),
      }))
      .filter((d) => d.department || d.sections.length || d.semesters.length);
  };

  // Each block: batch + degree + departments (each with sections + semester)
  const cleanDegreePrograms = (programs) => {
    if (!Array.isArray(programs)) return [];
    return programs
      .map((p) => ({
        batch: str(p && p.batch),
        degree: str(p && p.degree),
        departments: cleanDepartments(p && p.departments),
      }))
      .filter((p) => p.batch || p.degree || p.departments.length);
  };

  return services
    .filter((s) => s && String(s.service || "").trim())
    .map((s) => ({
      service: String(s.service).trim(),
      year: str(s.year),
      serviceModals: cleanStrArray(s.serviceModals),
      batches: cleanStrArray(s.batches),
      degreePrograms: cleanDegreePrograms(s.degreePrograms),
    }));
};

// Shared validation for contact persons. Also normalises each entry so the
// controller stores a consistent shape regardless of what the caller sent
// (missing contactType, stringly typed isPrimary, extra whitespace).
//
// Each contact has a REQUIRED name + primary email + primary phone, plus two
// OPTIONAL fields — secondaryEmail and secondaryPhoneNumber — that live on
// the same document. Optional means the field can be empty; when present it
// still has to be well-formed (a secondary email that fails the email regex
// is a validation error, not a silent drop).
const validateContactPersons = (contactPersons) => {
  if (!Array.isArray(contactPersons) || contactPersons.length === 0) {
    return { error: "At least one contact person is required" };
  }

  const emailSet = new Set();
  const normalized = [];
  let primaryCount = 0;
  for (const person of contactPersons) {
    if (!person || !person.name || !person.email || !person.phoneNumber) {
      return { error: "Each contact person must have name, email, and phone number" };
    }
    if (!emailRegex.test(person.email)) {
      return { error: `Invalid email format for ${person.name}` };
    }
    const key = String(person.email).toLowerCase();
    if (emailSet.has(key)) {
      return { error: `Duplicate email ${person.email} in contact persons` };
    }
    emailSet.add(key);

    const secondaryEmailRaw = person.secondaryEmail ? String(person.secondaryEmail).trim() : "";
    if (secondaryEmailRaw) {
      if (!emailRegex.test(secondaryEmailRaw)) {
        return { error: `Invalid secondary email format for ${person.name}` };
      }
      const secKey = secondaryEmailRaw.toLowerCase();
      // A contact's own primary and secondary must not collide, and no other
      // contact's primary may match either. Duplicates across secondaries of
      // different people are fine — two contacts sharing a reception line is
      // realistic and not the kind of duplicate the form is trying to prevent.
      if (secKey === key) {
        return { error: `Secondary email must differ from the primary email for ${person.name}` };
      }
      if (emailSet.has(secKey)) {
        return { error: `Duplicate email ${secondaryEmailRaw} in contact persons` };
      }
    }
    const secondaryPhoneRaw = person.secondaryPhoneNumber ? String(person.secondaryPhoneNumber).trim() : "";

    const isPrimary = Boolean(person.isPrimary);
    if (isPrimary) primaryCount += 1;
    normalized.push({
      name: String(person.name).trim(),
      email: String(person.email).trim(),
      phoneNumber: String(person.phoneNumber).trim(),
      secondaryEmail: secondaryEmailRaw,
      secondaryPhoneNumber: secondaryPhoneRaw,
      // Per-contact postal address (Address Line / State / City / Pincode,
      // joined by the form). Normalisation rebuilds each contact from
      // scratch, so an omitted key here would silently drop the address
      // on every write.
      address: person.address ? String(person.address).trim() : "",
      designation: person.designation ? String(person.designation).trim() : "",
      contactType: person.contactType ? String(person.contactType).trim() : "",
      isPrimary,
    });
  }
  // Exactly one primary — the frontend enforces it too, but the server
  // guards against a raw API caller sending zero or two.
  if (primaryCount === 0) {
    normalized[0].isPrimary = true;
  } else if (primaryCount > 1) {
    let seen = false;
    normalized.forEach((p) => {
      if (!p.isPrimary) return;
      if (seen) p.isPrimary = false;
      else seen = true;
    });
  }
  return { contacts: normalized };
};

const clientManagementController = {
  // Create a new standalone client
  createClient: async (req, res) => {
    try {
      const institutionId = req.user.institution;

      const {
        clientCompany,
        clientPhone,
        createdYear,
        description,
        website,
        clientAddress,
        clientLogo,
        clientLogoPosition,
        status,
        type,
        businessModel,
        services,
        contactPersons,
      } = req.body;

      if (!clientCompany || !String(clientCompany).trim()) {
        return res.status(400).json({
          success: false,
          message: "Client company name is required",
        });
      }

      if (!businessModel || !BUSINESS_MODELS.includes(businessModel)) {
        return res.status(400).json({
          success: false,
          message: "Business model is required (B2B, B2I or B2C)",
        });
      }

      // Address is required. The form stores TipTap HTML, so a bare "<p></p>"
      // is "empty" — strip tags and trim before deciding.
      const addressText = String(clientAddress || "").replace(/<[^>]+>/g, "").trim();
      if (!addressText) {
        return res.status(400).json({
          success: false,
          message: "Address is required",
        });
      }

      const { error: contactError, contacts: normalizedContacts } = validateContactPersons(contactPersons);
      if (contactError) {
        return res.status(400).json({ success: false, message: contactError });
      }

      const typeArray = Array.isArray(type) ? type : type ? [type] : [];

      // Prevent duplicate company within the same institution
      const existing = await ClientManagement.findOne({
        institution: institutionId,
        clientCompany: new RegExp(`^${String(clientCompany).trim()}$`, "i"),
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `A client named "${clientCompany}" already exists`,
        });
      }

      // Reference year the user picked in the form — if it's a plausible
      // 4-digit year we override the auto `createdAt` (Jan 1 of that year)
      // so the Created Year column matches. Nonsense values fall back to
      // Mongoose's automatic timestamp.
      const parsedYear = parseInt(String(createdYear || ""), 10);
      const nowYear = new Date().getFullYear();
      const createdAtOverride = Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= nowYear
        ? new Date(parsedYear, 0, 1)
        : undefined;

      // createClientWithId wraps the Counter-based clientId allocation and
      // retries on the rare duplicate-key race — see the helper's own note.
      const client = await createClientWithId(institutionId, {
        institution: institutionId,
        clientCompany: String(clientCompany).trim(),
        clientPhone: clientPhone ? String(clientPhone).trim() : "",
        description: description || "",
        website: website ? String(website).trim() : "",
        clientAddress: clientAddress || "",
        clientLogo: clientLogo || "",
        clientLogoPosition: clientLogoPosition ? String(clientLogoPosition).trim() : "",
        status: status === "inactive" ? "inactive" : "active",
        type: typeArray,
        businessModel,
        services: normalizeServices(services),
        contactPersons: normalizedContacts,
        createdBy: req.user.email,
        ...(createdAtOverride ? { createdAt: createdAtOverride, updatedAt: createdAtOverride } : {}),
      });

      res.status(201).json({
        success: true,
        message: "Client added successfully",
        data: client,
      });
    } catch (error) {
      console.error("Error adding client:", error);
      res.status(500).json({
        success: false,
        message: "Error adding client",
        error: error.message,
      });
    }
  },

  // Get all clients for the current institution
  getAllClients: async (req, res) => {
    try {
      const institutionId = req.user.institution;
      // `{}` for every role except a POC, which gets `{ _id: { $in: [...] } }`
      // — the clients reachable from the courses it is enrolled in. An empty
      // scope yields `$in: []`, i.e. no rows: a POC enrolled in nothing sees
      // nothing rather than the institution list.
      const scopeMatch = pocClientFilter(req.pocScope);

      // ── Paginated mode (opt-in via `page`) ────────────────────────────────
      // Without `page` this returns the whole list exactly as it always has,
      // so every other consumer is untouched. With `page`, the search, the
      // four filters and the sort all run in Mongo and one page crosses the
      // wire — the page's own predicate, ported field for field.
      if (req.query.page !== undefined) {
        return await getClientsPaginated(req, res, institutionId, scopeMatch);
      }

      // Names only. The Add/Edit form warns inline when a company name is
      // already taken, which it did by scanning the full list it happened to
      // hold. With the list paginated that check would only see one page, so
      // the form asks for just the names — two fields per client instead of a
      // whole document. (The server enforces the same rule on create/update
      // regardless; this keeps the error appearing on blur rather than only
      // after submit.)
      if (req.query.names === "1" || req.query.names === "true") {
        const names = await ClientManagement.find({ institution: institutionId, ...scopeMatch })
          .select("clientCompany")
          .lean();
        return res.status(200).json({ success: true, count: names.length, data: names });
      }

      // Read-only path — .lean() halves serialization + memory overhead on
      // the BM list; res.json only ever inspects plain values.
      const clients = await ClientManagement.find({ institution: institutionId, ...scopeMatch })
        .sort({ createdAt: -1 })
        .lean();

      // Backfill Client IDs for any legacy record still missing one, so the UI
      // never has to guess at what to show — a POC never triggers this path,
      // so the write can only happen for admin-level readers.
      const withIds = await backfillClientIds(institutionId, clients);

      res.status(200).json({
        success: true,
        count: withIds.length,
        data: withIds,
      });
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching clients",
        error: error.message,
      });
    }
  },

  // Get a single client by id
  getClientById: async (req, res) => {
    try {
      const institutionId = req.user.institution;
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
      }

      // Membership test rather than merging a filter: spreading the scope into
      // the query below would produce `{ _id: clientId, ..., _id: { $in } }`,
      // where the second key silently overwrites the first. The reply reuses
      // the existing 404 so an out-of-scope id is indistinguishable from a
      // missing one — a POC cannot probe for which clients exist.
      if (!scopeHasClient(req.pocScope, clientId)) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }

      const client = await ClientManagement.findOne({
        _id: clientId,
        institution: institutionId,
      });

      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }

      // Backfill this one record if it predates the clientId column, so the
      // full-details view carries the same identifier the list does.
      if (!client.clientId) {
        const [enriched] = await backfillClientIds(institutionId, [client.toObject()]);
        if (enriched?.clientId) client.clientId = enriched.clientId;
      }

      res.status(200).json({ success: true, data: client });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching client",
        error: error.message,
      });
    }
  },

  // Update a client
  updateClient: async (req, res) => {
    try {
      const institutionId = req.user.institution;
      const { clientId } = req.params;
      const updateData = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
      }

      const client = await ClientManagement.findOne({
        _id: clientId,
        institution: institutionId,
      });

      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }

      if (updateData.contactPersons !== undefined) {
        const { error: contactError, contacts: normalizedContacts } = validateContactPersons(updateData.contactPersons);
        if (contactError) {
          return res.status(400).json({ success: false, message: contactError });
        }
        client.contactPersons = normalizedContacts;
      }

      // clientId is READ ONLY — allocated once at create time and never
      // regenerated. Any attempt to set it through the update payload is
      // silently ignored so a stale form (or a malicious client) can't
      // rewrite the identifier.

      if (updateData.clientPhone !== undefined) {
        client.clientPhone = String(updateData.clientPhone || "").trim();
      }

      if (updateData.clientCompany !== undefined) {
        if (!String(updateData.clientCompany).trim()) {
          return res.status(400).json({
            success: false,
            message: "Client company name is required",
          });
        }

        // Ensure no other client in this institution uses the new name
        const duplicate = await ClientManagement.findOne({
          _id: { $ne: clientId },
          institution: institutionId,
          clientCompany: new RegExp(`^${String(updateData.clientCompany).trim()}$`, "i"),
        });
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: `A client named "${updateData.clientCompany}" already exists`,
          });
        }
        client.clientCompany = String(updateData.clientCompany).trim();
      }

      if (updateData.type !== undefined) {
        client.type = Array.isArray(updateData.type)
          ? updateData.type
          : updateData.type
          ? [updateData.type]
          : [];
      }

      if (updateData.businessModel !== undefined) {
        if (!BUSINESS_MODELS.includes(updateData.businessModel)) {
          return res.status(400).json({
            success: false,
            message: "Business model must be one of B2B, B2I or B2C",
          });
        }
        client.businessModel = updateData.businessModel;
      }

      if (updateData.services !== undefined) {
        client.services = normalizeServices(updateData.services);
      }

      // Address is required. If a caller sends `clientAddress` on update,
      // the tag-stripped value must have some text — otherwise refuse the
      // write so a legacy record isn't accidentally blanked out. Callers
      // that just omit the key keep whatever address is on file.
      if (updateData.clientAddress !== undefined) {
        const addressText = String(updateData.clientAddress || "").replace(/<[^>]+>/g, "").trim();
        if (!addressText) {
          return res.status(400).json({
            success: false,
            message: "Address is required",
          });
        }
      }

      const editableFields = [
        "description",
        "website",
        "clientAddress",
        "clientLogo",
        "clientLogoPosition",
        "status",
      ];
      editableFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          client[field] = updateData[field];
        }
      });

      client.updatedBy = req.user.email;
      await client.save();

      res.status(200).json({
        success: true,
        message: "Client updated successfully",
        data: client,
      });
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({
        success: false,
        message: "Error updating client",
        error: error.message,
      });
    }
  },

  // Delete a client
  deleteClient: async (req, res) => {
    try {
      const institutionId = req.user.institution;
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
      }

      const client = await ClientManagement.findOneAndDelete({
        _id: clientId,
        institution: institutionId,
      });

      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }

      res.status(200).json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting client",
        error: error.message,
      });
    }
  },

  // Toggle active / inactive status
  toggleClientStatus: async (req, res) => {
    try {
      const institutionId = req.user.institution;
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID format",
        });
      }

      const client = await ClientManagement.findOne({
        _id: clientId,
        institution: institutionId,
      });

      if (!client) {
        return res.status(404).json({ success: false, message: "Client not found" });
      }

      client.status = client.status === "active" ? "inactive" : "active";
      client.updatedBy = req.user.email;
      await client.save();

      res.status(200).json({
        success: true,
        message: `Client ${client.status === "active" ? "activated" : "deactivated"} successfully`,
        data: {
          clientId: client._id,
          clientCompany: client.clientCompany,
          status: client.status,
        },
      });
    } catch (error) {
      console.error("Error toggling client status:", error);
      res.status(500).json({
        success: false,
        message: "Error toggling client status",
        error: error.message,
      });
    }
  },

  // Upload a client logo. Accepts a single image file (jpg, png or webp)
  // under the field name `logo`, streams the buffer to Cloudinary under
  // `lms/client-logos/<institution>/`, and returns Cloudinary's public
  // https URL. That URL is what the frontend saves on the client record;
  // every render site (`ClientAvatar`, cards, details drawer/page) reads
  // the same URL regardless of where the bits actually live.
  //
  // Migrated from local disk (Server/uploads/client-logos) to Cloudinary
  // so multiple instances (dev/staging/prod) all see the same asset — the
  // old local URL was tied to the request's host and broke as soon as a
  // record moved between environments. Existing records with old
  // `/uploads/client-logos/...` URLs keep working exactly as before; new
  // uploads land on Cloudinary, old ones stay on disk until they're
  // replaced or removed.
  //
  // Deliberately does NOT mutate any client record: the ADD flow uploads
  // BEFORE the client exists (there's no id yet), and the edit flow
  // separately submits the URL through updateClient. Keeping this endpoint
  // pure means both flows share the same upload path.
  uploadClientLogo: async (req, res) => {
    try {
      const file = req.files && (req.files.logo || req.files.file);
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No logo file uploaded (expected multipart field 'logo')",
        });
      }

      // Cloudinary must be configured at boot. If the env is missing
      // there's no point sending anything upstream — fail fast so the
      // frontend gets a clear error instead of an opaque 500 from the
      // SDK later.
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({
          success: false,
          message: "Cloudinary is not configured on the server",
        });
      }

      // jpg/png/webp only. The check is on BOTH mimetype and extension:
      // mimetype alone is set by the client and easy to spoof, extension
      // alone misses files that were renamed. Either one lying is enough
      // to reject.
      const ALLOWED_MIME = new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ]);
      const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
      const ext = path.extname(String(file.name || "")).toLowerCase();
      if (!ALLOWED_MIME.has(String(file.mimetype || "").toLowerCase()) || !ALLOWED_EXT.has(ext)) {
        return res.status(400).json({
          success: false,
          message: "Only JPG, PNG or WebP images are allowed",
        });
      }

      // 5 MB cap for a logo — enough for a large PNG, small enough that a
      // sloppy screenshot upload doesn't waste bandwidth. The global
      // express-fileupload limit is 100 MB, so this is the tighter of the
      // two and applies first.
      const MAX_BYTES = 5 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        return res.status(400).json({
          success: false,
          message: "Logo must be 5 MB or smaller",
        });
      }

      const institutionId = req.user && req.user.institution
        ? String(req.user.institution)
        : "shared";

      // Folder per institution so tenant assets are grouped and a future
      // cleanup can be filtered by the folder prefix. `unique_filename`
      // + `use_filename: false` lets Cloudinary pick a fresh id every time
      // — we don't reuse the client-supplied filename (path separators,
      // duplicates), and we don't need our own timestamp/random because
      // Cloudinary already generates a unique public_id.
      const folder = `lms/client-logos/${institutionId}`;

      // Buffer path — express-fileupload with useTempFiles: false gives
      // us `file.data` as a Buffer. Stream it into Cloudinary's
      // `upload_stream` via streamifier so nothing touches the disk.
      const uploadFromBuffer = () => new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
            // Restrict server-side too — Cloudinary honours the allowed
            // formats list, so a spoofed mimetype gets caught here as well.
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            unique_filename: true,
            use_filename: false,
            overwrite: false,
          },
          (err, result) => {
            if (err) return reject(err);
            if (!result || !result.secure_url) {
              return reject(new Error("Cloudinary did not return a URL"));
            }
            resolve(result);
          }
        );
        streamifier.createReadStream(file.data).pipe(stream);
      });

      const result = await uploadFromBuffer();

      res.status(201).json({
        success: true,
        message: "Client logo uploaded",
        data: {
          // The secure https URL is what the record stores. `public_id`
          // is returned as well so future flows (delete, re-crop) can
          // address the same asset without having to parse the URL.
          url: result.secure_url,
          publicId: result.public_id,
        },
      });
    } catch (error) {
      console.error("Error uploading client logo:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading client logo",
        error: error.message,
      });
    }
  },
};

module.exports = clientManagementController;
