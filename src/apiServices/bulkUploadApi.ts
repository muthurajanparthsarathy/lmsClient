import axios from "axios";

const BASE_URL = "http://localhost:5533";

export const bulkUploadApi = {
  /**
   * Upload a document for parsing.  Returns parsed preview data.
   * @param {string} entityType  modules | submodules | topics | subtopics
   * @param {string} entityId
   * @param {string} exerciseId
   * @param {File}   file         .json | .csv | .txt
   * @param {string} tabType      I_Do | We_Do | You_Do
   * @param {string} subcategory
   */
  parseDocument: async (entityType, entityId, exerciseId, file, tabType, subcategory) => {
  const token = localStorage.getItem("smartcliff_token");
  const fd = new FormData();
  
  // If file content looks like JSON, force the correct name/type
  const reader = new FileReader();
  const text = await new Promise<string>((res) => {
    reader.onload = (e) => res(e.target?.result as string || "");
    reader.readAsText(file.slice(0, 20));
  });
  
  const isJSON = text.trim().startsWith("{") || text.trim().startsWith("[");
  const correctedFile = isJSON && !file.name.endsWith(".json")
    ? new File([file], file.name.replace(/\.[^.]+$/, ".json"), { type: "application/json" })
    : file;

  fd.append("document", correctedFile);
  fd.append("tabType", tabType);
  fd.append("subcategory", subcategory);
    const res = await axios.post(
      `${BASE_URL}/bulk-upload/parse/${entityType}/${entityId}/exercise/${exerciseId}`,
      fd,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        timeout: 60_000,
      }
    );
    return res.data;
  },

  /**
   * Insert the selected (confirmed) questions.
   * @param {string}   entityType
   * @param {string}   entityId
   * @param {string}   exerciseId
   * @param {string}   tabType
   * @param {string}   subcategory
   * @param {object[]} questions   normalised MCQ question objects
   */
  insertQuestions: async (entityType, entityId, exerciseId, tabType, subcategory, questions) => {
    const token = localStorage.getItem("smartcliff_token");
    const res = await axios.post(
      `${BASE_URL}/bulk-upload/insert/${entityType}/${entityId}/exercise/${exerciseId}`,
      { tabType, subcategory, questions },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 60_000,
      }
    );
    return res.data;
  },

  /**
   * Download a sample template file.
   * @param {"json"|"csv"|"txt"} format
   */
  downloadTemplate: (format = "json") => {
    const token = localStorage.getItem("smartcliff_token");
    const url = `${BASE_URL}/bulk-upload/template/${format}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mcq_template.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};