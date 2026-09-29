// Per-language trace runtimes for the step-through visualizer.
//
// Each runtime is a small helper added to the reader's program (appended, or
// prepended with a `#line 1` reset for C/C++, so compiler line numbers stay
// true). The trace calls placed by instrument.ts go through it, and it prints
// one step at a time between markers:
//
//   @@PTS@@{"l":line,"f":"function","d":stackDepth,"v":[["name",VALUE],…]}@@PTE@@
//   @@PTX@@   ← printed once when the step limit is reached
//
//   VALUE  {"t":"int","v":"5"}                  a primitive
//          {"r":"id","o":OBJECT}                an object (drawn with an arrow)
//          {"r":"id"}                           an object already sent / too deep
//   OBJECT {"k":"list"|"set","n":3,"e":[VALUE…]}
//          {"k":"dict","n":2,"m":[[VALUE,VALUE]…]}
//          {"k":"instance","c":"Point","a":[["x",VALUE]…]}
//          {"k":"object","c":"Scanner","s":"text"}
//
// Ruby has a real line tracer (TracePoint), so like Python its source is not
// touched at all: a harness evals it with tracing on.

import { instrument, type ILang } from './instrument'

export const MAX_STEPS = 300

const JAVA = String.raw`
class __PT {
    static int n = 0;
    static java.util.IdentityHashMap<Object, Boolean> seen = new java.util.IdentityHashMap<>();
    static void t(int l, String f, Object[] kv) {
        if (n >= 300) { if (n++ == 300) { System.out.print("@@PTX@@"); System.out.flush(); } return; }
        n++;
        StringBuilder sb = new StringBuilder(256);
        sb.append("@@PTS@@{\"l\":").append(l).append(",\"f\":"); js(sb, f);
        sb.append(",\"d\":").append(Thread.currentThread().getStackTrace().length).append(",\"v\":[");
        seen.clear();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            if (i > 0) sb.append(',');
            sb.append('['); js(sb, String.valueOf(kv[i])); sb.append(',');
            StringBuilder one = new StringBuilder();
            try { v(one, kv[i + 1], 0); sb.append(one); } catch (Throwable e) { sb.append("{\"t\":\"?\",\"v\":\"?\"}"); }
            sb.append(']');
        }
        sb.append("]}@@PTE@@");
        System.out.print(sb); System.out.flush();
    }
    static void js(StringBuilder sb, String s) {
        if (s == null) s = "null";
        if (s.length() > 200) s = s.substring(0, 200) + "...";
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"') sb.append("\\\"");
            else if (c == '\\') sb.append("\\\\");
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else if (c == '\t') sb.append("\\t");
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        sb.append('"');
    }
    static void p(StringBuilder sb, String t, String v) { sb.append("{\"t\":"); js(sb, t); sb.append(",\"v\":"); js(sb, v); sb.append('}'); }
    static void v(StringBuilder sb, Object o, int d) throws Exception {
        if (o == null) { p(sb, "NoneType", "null"); return; }
        if (o instanceof Boolean) { p(sb, "bool", o.toString()); return; }
        if (o instanceof Character) { p(sb, "char", "'" + o + "'"); return; }
        if (o instanceof Integer || o instanceof Long || o instanceof Short || o instanceof Byte) { p(sb, "int", o.toString()); return; }
        if (o instanceof Double || o instanceof Float) { p(sb, "float", o.toString()); return; }
        if (o instanceof String) { p(sb, "str", (String) o); return; }
        if (o instanceof Enum) { p(sb, "enum", ((Enum<?>) o).name()); return; }
        String id = Integer.toHexString(System.identityHashCode(o));
        sb.append("{\"r\":\"").append(id).append('"');
        if (seen.containsKey(o) || d > 2) { sb.append('}'); return; }
        seen.put(o, true);
        sb.append(",\"o\":");
        Class<?> c = o.getClass();
        if (c.getName().contains("$$Lambda") || c.isSynthetic()) {
            sb.append("{\"k\":\"function\",\"c\":\"lambda\"}");
        } else if (c.isArray()) {
            int len = java.lang.reflect.Array.getLength(o);
            sb.append("{\"k\":\"list\",\"n\":").append(len).append(",\"e\":[");
            for (int i = 0; i < Math.min(len, 50); i++) { if (i > 0) sb.append(','); v(sb, java.lang.reflect.Array.get(o, i), d + 1); }
            sb.append("]}");
        } else if (o instanceof java.util.Map) {
            java.util.Map<?, ?> m = (java.util.Map<?, ?>) o;
            sb.append("{\"k\":\"dict\",\"n\":").append(m.size()).append(",\"m\":[");
            int i = 0;
            for (java.util.Map.Entry<?, ?> e : m.entrySet()) {
                if (i >= 50) break;
                if (i++ > 0) sb.append(',');
                sb.append('['); v(sb, e.getKey(), d + 1); sb.append(','); v(sb, e.getValue(), d + 1); sb.append(']');
            }
            sb.append("]}");
        } else if (o instanceof java.util.Collection) {
            java.util.Collection<?> col = (java.util.Collection<?>) o;
            sb.append("{\"k\":\"").append(o instanceof java.util.Set ? "set" : "list").append("\",\"n\":").append(col.size()).append(",\"e\":[");
            int i = 0;
            for (Object x : col) { if (i >= 50) break; if (i++ > 0) sb.append(','); v(sb, x, d + 1); }
            sb.append("]}");
        } else if (c.getName().startsWith("java.") || c.getName().startsWith("javax.") || c.getName().startsWith("jdk.") || c.getName().startsWith("sun.")) {
            sb.append("{\"k\":\"object\",\"c\":"); js(sb, c.getSimpleName()); sb.append(",\"s\":");
            js(sb, o instanceof CharSequence || o instanceof Number ? o.toString() : c.getSimpleName()); sb.append('}');
        } else {
            sb.append("{\"k\":\"instance\",\"c\":"); js(sb, c.getSimpleName()); sb.append(",\"a\":[");
            int i = 0;
            for (Class<?> k = c; k != null && k != Object.class; k = k.getSuperclass()) {
                for (java.lang.reflect.Field fl : k.getDeclaredFields()) {
                    if (java.lang.reflect.Modifier.isStatic(fl.getModifiers()) || fl.isSynthetic() || i >= 30) continue;
                    if (i++ > 0) sb.append(',');
                    sb.append('['); js(sb, fl.getName()); sb.append(',');
                    Object fv;
                    try { fl.setAccessible(true); fv = fl.get(o); } catch (Throwable e) { fv = "?"; }
                    v(sb, fv, d + 1);
                    sb.append(']');
                }
            }
            sb.append("]}");
        }
        sb.append('}');
    }
}
`

const KOTLIN = String.raw`
object __PT {
    var n = 0
    val seen = java.util.IdentityHashMap<Any, Boolean>()
    @JvmStatic fun t(l: Int, f: String, kv: Array<Any?>) {
        if (n >= 300) { if (n++ == 300) { print("@@PTX@@"); System.out.flush() }; return }
        n++
        val sb = StringBuilder()
        sb.append("@@PTS@@{\"l\":").append(l).append(",\"f\":"); js(sb, f)
        sb.append(",\"d\":").append(Thread.currentThread().stackTrace.size).append(",\"v\":[")
        seen.clear()
        var i = 0
        while (i + 1 < kv.size) {
            if (i > 0) sb.append(',')
            sb.append('['); js(sb, kv[i].toString()); sb.append(',')
            val one = StringBuilder()
            try { v(one, kv[i + 1], 0); sb.append(one) } catch (e: Throwable) { sb.append("{\"t\":\"?\",\"v\":\"?\"}") }
            sb.append(']')
            i += 2
        }
        sb.append("]}@@PTE@@")
        print(sb); System.out.flush()
    }
    fun js(sb: StringBuilder, s0: String?) {
        var s = s0 ?: "null"
        if (s.length > 200) s = s.substring(0, 200) + "..."
        sb.append('"')
        for (c in s) {
            if (c == '"') sb.append("\\\"")
            else if (c == '\\') sb.append("\\\\")
            else if (c == '\n') sb.append("\\n")
            else if (c == '\r') sb.append("\\r")
            else if (c == '\t') sb.append("\\t")
            else if (c < ' ') sb.append(String.format("\\u%04x", c.toString().codePointAt(0)))
            else sb.append(c)
        }
        sb.append('"')
    }
    fun p(sb: StringBuilder, t: String, v: String) { sb.append("{\"t\":"); js(sb, t); sb.append(",\"v\":"); js(sb, v); sb.append('}') }
    fun v(sb: StringBuilder, o: Any?, d: Int) {
        if (o == null) { p(sb, "NoneType", "null"); return }
        if (o is Boolean) { p(sb, "bool", o.toString()); return }
        if (o is Char) { p(sb, "char", "'" + o + "'"); return }
        if (o is Int || o is Long || o is Short || o is Byte) { p(sb, "int", o.toString()); return }
        if (o is Double || o is Float) { p(sb, "float", o.toString()); return }
        if (o is String) { p(sb, "str", o); return }
        if (o is Enum<*>) { p(sb, "enum", o.name); return }
        val id = Integer.toHexString(System.identityHashCode(o))
        sb.append("{\"r\":\"").append(id).append('"')
        if (seen.containsKey(o) || d > 2) { sb.append('}'); return }
        seen[o] = true
        sb.append(",\"o\":")
        val c = o.javaClass
        if (o is Function<*>) {
            sb.append("{\"k\":\"function\",\"c\":\"lambda\"}")
        } else if (c.isArray) {
            val len = java.lang.reflect.Array.getLength(o)
            sb.append("{\"k\":\"list\",\"n\":").append(len).append(",\"e\":[")
            for (i in 0 until minOf(len, 50)) { if (i > 0) sb.append(','); v(sb, java.lang.reflect.Array.get(o, i), d + 1) }
            sb.append("]}")
        } else if (o is Map<*, *>) {
            sb.append("{\"k\":\"dict\",\"n\":").append(o.size).append(",\"m\":[")
            var i = 0
            for (e in o.entries) {
                if (i >= 50) break
                if (i++ > 0) sb.append(',')
                sb.append('['); v(sb, e.key, d + 1); sb.append(','); v(sb, e.value, d + 1); sb.append(']')
            }
            sb.append("]}")
        } else if (o is Collection<*>) {
            sb.append("{\"k\":\"").append(if (o is Set<*>) "set" else "list").append("\",\"n\":").append(o.size).append(",\"e\":[")
            var i = 0
            for (x in o) { if (i >= 50) break; if (i++ > 0) sb.append(','); v(sb, x, d + 1) }
            sb.append("]}")
        } else if (c.name.startsWith("java.") || c.name.startsWith("kotlin.") || c.name.startsWith("jdk.")) {
            sb.append("{\"k\":\"object\",\"c\":"); js(sb, c.simpleName); sb.append(",\"s\":")
            js(sb, if (o is CharSequence || o is Number) o.toString() else c.simpleName); sb.append('}')
        } else {
            sb.append("{\"k\":\"instance\",\"c\":"); js(sb, c.simpleName); sb.append(",\"a\":[")
            var i = 0
            var k: Class<*>? = c
            while (k != null && k != Any::class.java) {
                for (fl in k.declaredFields) {
                    if (java.lang.reflect.Modifier.isStatic(fl.modifiers) || fl.isSynthetic || i >= 30) continue
                    if (i++ > 0) sb.append(',')
                    sb.append('['); js(sb, fl.name); sb.append(',')
                    val fv: Any? = try { fl.isAccessible = true; fl.get(o) } catch (e: Throwable) { "?" }
                    v(sb, fv, d + 1)
                    sb.append(']')
                }
                k = k.superclass
            }
            sb.append("]}")
        }
        sb.append('}')
    }
}
`

const CSHARP = String.raw`
static class __PT
{
    static int n = 0;
    static System.Collections.Generic.HashSet<object> seen = new System.Collections.Generic.HashSet<object>(new __PTRef());
    public static void T(int l, string f, object[] kv)
    {
        if (n >= 300) { if (n++ == 300) { System.Console.Write("@@PTX@@"); System.Console.Out.Flush(); } return; }
        n++;
        var sb = new System.Text.StringBuilder();
        sb.Append("@@PTS@@{\"l\":").Append(l).Append(",\"f\":"); Js(sb, f);
        sb.Append(",\"d\":").Append(new System.Diagnostics.StackTrace().FrameCount).Append(",\"v\":[");
        seen.Clear();
        for (int i = 0; i + 1 < kv.Length; i += 2)
        {
            if (i > 0) sb.Append(',');
            sb.Append('['); Js(sb, System.Convert.ToString(kv[i])); sb.Append(',');
            var one = new System.Text.StringBuilder();
            try { V(one, kv[i + 1], 0); sb.Append(one.ToString()); } catch { sb.Append("{\"t\":\"?\",\"v\":\"?\"}"); }
            sb.Append(']');
        }
        sb.Append("]}@@PTE@@");
        System.Console.Write(sb.ToString()); System.Console.Out.Flush();
    }
    static void Js(System.Text.StringBuilder sb, string s)
    {
        if (s == null) s = "null";
        if (s.Length > 200) s = s.Substring(0, 200) + "...";
        sb.Append('"');
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        sb.Append('"');
    }
    static void P(System.Text.StringBuilder sb, string t, string v) { sb.Append("{\"t\":"); Js(sb, t); sb.Append(",\"v\":"); Js(sb, v); sb.Append('}'); }
    static void V(System.Text.StringBuilder sb, object o, int d)
    {
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        if (o == null) { P(sb, "NoneType", "null"); return; }
        if (o is bool) { P(sb, "bool", ((bool)o) ? "true" : "false"); return; }
        if (o is char) { P(sb, "char", "'" + o + "'"); return; }
        if (o is int || o is long || o is short || o is byte || o is sbyte || o is uint || o is ulong || o is ushort) { P(sb, "int", System.Convert.ToString(o, inv)); return; }
        if (o is double || o is float || o is decimal) { P(sb, "float", System.Convert.ToString(o, inv)); return; }
        if (o is string) { P(sb, "str", (string)o); return; }
        if (o is System.Enum) { P(sb, "enum", o.ToString()); return; }
        var type = o.GetType();
        string id = System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(o).ToString("x");
        sb.Append("{\"r\":\"").Append(id).Append('"');
        if (seen.Contains(o) || d > 2) { sb.Append('}'); return; }
        seen.Add(o);
        sb.Append(",\"o\":");
        if (o is System.Collections.IDictionary)
        {
            var m = (System.Collections.IDictionary)o;
            sb.Append("{\"k\":\"dict\",\"n\":").Append(m.Count).Append(",\"m\":[");
            int i = 0;
            foreach (System.Collections.DictionaryEntry e in m)
            {
                if (i >= 50) break;
                if (i++ > 0) sb.Append(',');
                sb.Append('['); V(sb, e.Key, d + 1); sb.Append(','); V(sb, e.Value, d + 1); sb.Append(']');
            }
            sb.Append("]}");
        }
        else if (o is System.Collections.IEnumerable)
        {
            var items = new System.Collections.Generic.List<object>();
            int count = 0;
            foreach (var x in (System.Collections.IEnumerable)o) { if (items.Count < 50) items.Add(x); count++; }
            sb.Append("{\"k\":\"").Append(type.Name.StartsWith("HashSet") || type.Name.StartsWith("SortedSet") ? "set" : "list").Append("\",\"n\":").Append(count).Append(",\"e\":[");
            for (int i = 0; i < items.Count; i++) { if (i > 0) sb.Append(','); V(sb, items[i], d + 1); }
            sb.Append("]}");
        }
        else if (type.Namespace != null && type.Namespace.StartsWith("System"))
        {
            sb.Append("{\"k\":\"object\",\"c\":"); Js(sb, type.Name); sb.Append(",\"s\":"); Js(sb, System.Convert.ToString(o, inv)); sb.Append('}');
        }
        else
        {
            sb.Append("{\"k\":\"instance\",\"c\":"); Js(sb, type.Name); sb.Append(",\"a\":[");
            int i = 0;
            foreach (var fl in type.GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic))
            {
                if (i >= 30) break;
                string name = fl.Name;
                if (name.StartsWith("<")) name = name.Substring(1, System.Math.Max(0, name.IndexOf('>') - 1));
                if (i++ > 0) sb.Append(',');
                sb.Append('['); Js(sb, name); sb.Append(',');
                object fv;
                try { fv = fl.GetValue(o); } catch { fv = "?"; }
                V(sb, fv, d + 1);
                sb.Append(']');
            }
            sb.Append("]}");
        }
        sb.Append('}');
    }
}
class __PTRef : System.Collections.Generic.IEqualityComparer<object>
{
    bool System.Collections.Generic.IEqualityComparer<object>.Equals(object a, object b) { return object.ReferenceEquals(a, b); }
    int System.Collections.Generic.IEqualityComparer<object>.GetHashCode(object o) { return System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(o); }
}
`

// Go: the helper imports go on the `package main` line (aliased, so they
// never clash with the reader's own imports); the functions go at the end.
const GO_IMPORTS = 'import (__ptfmt "fmt"; __ptrf "reflect"; __ptrt "runtime"; __ptsc "strconv"; __ptstr "strings")'
const GO = String.raw`
var __ptN, __ptSeq int

func __pt(l int, f string, kv ...interface{}) {
	if __ptN >= 300 {
		if __ptN == 300 {
			__ptfmt.Print("@@PTX@@")
		}
		__ptN++
		return
	}
	__ptN++
	pcs := make([]uintptr, 256)
	d := __ptrt.Callers(0, pcs)
	var sb __ptstr.Builder
	sb.WriteString("@@PTS@@{\"l\":" + __ptsc.Itoa(l) + ",\"f\":" + __ptjs(f) + ",\"d\":" + __ptsc.Itoa(d) + ",\"v\":[")
	for i := 0; i+1 < len(kv); i += 2 {
		if i > 0 {
			sb.WriteString(",")
		}
		name, _ := kv[i].(string)
		var v string
		if e, ok := kv[i+1].(error); ok && e != nil {
			v = __ptprim("error", e.Error())
		} else {
			v = __ptval(__ptrf.ValueOf(kv[i+1]), 0)
		}
		sb.WriteString("[" + __ptjs(name) + "," + v + "]")
	}
	sb.WriteString("]}@@PTE@@")
	__ptfmt.Print(sb.String())
}

func __ptjs(s string) string {
	if len(s) > 200 {
		s = s[:200] + "..."
	}
	var b __ptstr.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString("\\\"")
		case '\\':
			b.WriteString("\\\\")
		case '\n':
			b.WriteString("\\n")
		case '\r':
			b.WriteString("\\r")
		case '\t':
			b.WriteString("\\t")
		default:
			if r < 0x20 {
				b.WriteString(__ptfmt.Sprintf("\\u%04x", r))
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func __ptprim(t, v string) string { return "{\"t\":" + __ptjs(t) + ",\"v\":" + __ptjs(v) + "}" }

func __ptref(id string) string { return "{\"r\":\"" + id + "\"}" }

func __ptval(v __ptrf.Value, d int) string {
	if !v.IsValid() {
		return __ptprim("NoneType", "nil")
	}
	switch v.Kind() {
	case __ptrf.Bool:
		return __ptprim("bool", __ptsc.FormatBool(v.Bool()))
	case __ptrf.Int, __ptrf.Int8, __ptrf.Int16, __ptrf.Int32, __ptrf.Int64:
		return __ptprim("int", __ptsc.FormatInt(v.Int(), 10))
	case __ptrf.Uint, __ptrf.Uint8, __ptrf.Uint16, __ptrf.Uint32, __ptrf.Uint64, __ptrf.Uintptr:
		return __ptprim("int", __ptsc.FormatUint(v.Uint(), 10))
	case __ptrf.Float32, __ptrf.Float64:
		return __ptprim("float", __ptsc.FormatFloat(v.Float(), 'g', -1, 64))
	case __ptrf.String:
		return __ptprim("str", v.String())
	case __ptrf.Interface:
		if v.IsNil() {
			return __ptprim("NoneType", "nil")
		}
		return __ptval(v.Elem(), d)
	case __ptrf.Ptr:
		if v.IsNil() {
			return __ptprim("NoneType", "nil")
		}
		id := "p" + __ptsc.FormatUint(uint64(v.Pointer()), 16)
		if d > 2 {
			return __ptref(id)
		}
		e := v.Elem()
		if e.Kind() == __ptrf.Struct {
			return "{\"r\":\"" + id + "\",\"o\":" + __ptstruct(e, d) + "}"
		}
		return "{\"r\":\"" + id + "\",\"o\":{\"k\":\"list\",\"n\":1,\"e\":[" + __ptval(e, d+1) + "]}}"
	case __ptrf.Slice, __ptrf.Array:
		var id string
		if v.Kind() == __ptrf.Slice {
			if v.IsNil() {
				return __ptprim("NoneType", "nil")
			}
			id = "s" + __ptsc.FormatUint(uint64(v.Pointer()), 16) + "_" + __ptsc.Itoa(v.Len())
		} else {
			__ptSeq++
			id = "a" + __ptsc.Itoa(__ptSeq)
		}
		if d > 2 {
			return __ptref(id)
		}
		var sb __ptstr.Builder
		sb.WriteString("{\"r\":\"" + id + "\",\"o\":{\"k\":\"list\",\"n\":" + __ptsc.Itoa(v.Len()) + ",\"e\":[")
		for i := 0; i < v.Len() && i < 50; i++ {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(__ptval(v.Index(i), d+1))
		}
		sb.WriteString("]}}")
		return sb.String()
	case __ptrf.Map:
		if v.IsNil() {
			return __ptprim("NoneType", "nil")
		}
		id := "m" + __ptsc.FormatUint(uint64(v.Pointer()), 16)
		if d > 2 {
			return __ptref(id)
		}
		keys := v.MapKeys()
		ks := make([]string, len(keys))
		for i, k := range keys {
			ks[i] = __ptval(k, d+1)
		}
		for i := 1; i < len(keys); i++ {
			for j := i; j > 0 && ks[j] < ks[j-1]; j-- {
				ks[j], ks[j-1] = ks[j-1], ks[j]
				keys[j], keys[j-1] = keys[j-1], keys[j]
			}
		}
		var sb __ptstr.Builder
		sb.WriteString("{\"r\":\"" + id + "\",\"o\":{\"k\":\"dict\",\"n\":" + __ptsc.Itoa(len(keys)) + ",\"m\":[")
		for i := 0; i < len(keys) && i < 50; i++ {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("[" + ks[i] + "," + __ptval(v.MapIndex(keys[i]), d+1) + "]")
		}
		sb.WriteString("]}}")
		return sb.String()
	case __ptrf.Struct:
		__ptSeq++
		return "{\"r\":\"o" + __ptsc.Itoa(__ptSeq) + "\",\"o\":" + __ptstruct(v, d) + "}"
	}
	return __ptprim(v.Type().String(), v.Type().String())
}

func __ptstruct(v __ptrf.Value, d int) string {
	var sb __ptstr.Builder
	t := v.Type()
	sb.WriteString("{\"k\":\"instance\",\"c\":" + __ptjs(t.Name()) + ",\"a\":[")
	for i := 0; i < v.NumField() && i < 30; i++ {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString("[" + __ptjs(t.Field(i).Name) + "," + __ptval(v.Field(i), d+1) + "]")
	}
	sb.WriteString("]}")
	return sb.String()
}
`

const JS = String.raw`
function __pt(l, f, kv) {
    var S = globalThis.__ptS || (globalThis.__ptS = { n: 0, ids: new WeakMap(), seq: 0 });
    if (S.n >= 300) { if (S.n++ === 300) process.stdout.write('@@PTX@@'); return; }
    S.n++;
    var lim = Error.stackTraceLimit; Error.stackTraceLimit = 500;
    var d = String(new Error().stack).split('\n').length;
    Error.stackTraceLimit = lim;
    var seen = new Set(), vars = [];
    for (var i = 0; i < kv.length; i++) {
        var x;
        try { x = kv[i][1](); } catch (e) { continue; }
        if (typeof x === 'function') continue;
        try { vars.push([kv[i][0], __ptv(x, 0, seen, S)]); } catch (e) { }
    }
    process.stdout.write('@@PTS@@' + JSON.stringify({ l: l, f: f, d: d, v: vars }) + '@@PTE@@');
}
function __ptid(x, S) { var id = S.ids.get(x); if (!id) { id = 'j' + (++S.seq); S.ids.set(x, id); } return id; }
function __ptv(x, d, seen, S) {
    if (x === null) return { t: 'NoneType', v: 'null' };
    if (x === undefined) return { t: 'NoneType', v: 'undefined' };
    var t = typeof x;
    if (t === 'boolean') return { t: 'bool', v: String(x) };
    if (t === 'number') return { t: Number.isInteger(x) ? 'int' : 'float', v: String(x) };
    if (t === 'bigint') return { t: 'int', v: String(x) + 'n' };
    if (t === 'string') return { t: 'str', v: x.length > 200 ? x.slice(0, 200) + '...' : x };
    if (t === 'symbol') return { t: 'symbol', v: String(x) };
    var id = __ptid(x, S);
    if (t === 'function') return { r: id, o: { k: 'function', c: x.name || 'function' } };
    if (seen.has(x) || d > 2) return { r: id };
    seen.add(x);
    var sub = function (y) { return __ptv(y, d + 1, seen, S); };
    var o;
    if (Array.isArray(x)) o = { k: 'list', n: x.length, e: x.slice(0, 50).map(sub) };
    else if (x instanceof Map) o = { k: 'dict', n: x.size, m: Array.from(x).slice(0, 50).map(function (p) { return [sub(p[0]), sub(p[1])]; }) };
    else if (x instanceof Set) o = { k: 'set', n: x.size, e: Array.from(x).slice(0, 50).map(sub) };
    else {
        var c = (x.constructor && x.constructor.name) || 'Object';
        var keys = Object.keys(x).filter(function (k) { return typeof x[k] !== 'function'; }).slice(0, 30);
        if (c === 'Object') o = { k: 'dict', n: keys.length, m: keys.map(function (k) { return [{ t: 'str', v: k }, sub(x[k])]; }) };
        else o = { k: 'instance', c: c, a: keys.map(function (k) { return [k, sub(x[k])]; }) };
    }
    return { r: id, o: o };
}
`

const PHP = String.raw`
function __pt($l, $vars) {
    static $n = 0;
    if ($n >= 300) { if ($n++ == 300) echo '@@PTX@@'; return; }
    $n++;
    $bt = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    $f = isset($bt[1]['function']) ? $bt[1]['function'] : '<global>';
    if (isset($bt[1]['class'])) $f = $bt[1]['class'] . '::' . $f;
    $skip = array('GLOBALS', '_GET', '_POST', '_COOKIE', '_FILES', '_SERVER', '_ENV', '_REQUEST', '_SESSION', 'argv', 'argc', 'http_response_header');
    $out = array();
    foreach ($vars as $k => $v) {
        if (in_array($k, $skip, true)) continue;
        if (is_resource($v)) continue;
        $out[] = array((string)$k, __ptv($v, 0));
    }
    echo '@@PTS@@' . json_encode(array('l' => $l, 'f' => $f, 'd' => count($bt), 'v' => $out), JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR) . '@@PTE@@';
    flush();
}
function __ptv($v, $d) {
    static $seq = 0;
    if (is_null($v)) return array('t' => 'NoneType', 'v' => 'null');
    if (is_bool($v)) return array('t' => 'bool', 'v' => $v ? 'true' : 'false');
    if (is_int($v)) return array('t' => 'int', 'v' => (string)$v);
    if (is_float($v)) return array('t' => 'float', 'v' => (string)$v);
    if (is_string($v)) return array('t' => 'str', 'v' => strlen($v) > 200 ? substr($v, 0, 200) . '...' : $v);
    if (is_array($v)) {
        $id = 'a' . (++$seq);
        if ($d > 2) return array('r' => $id);
        $isList = count($v) === 0 || array_keys($v) === range(0, count($v) - 1);
        $parts = array();
        $i = 0;
        foreach ($v as $k => $x) {
            if ($i++ >= 50) break;
            $parts[] = $isList ? __ptv($x, $d + 1) : array(__ptv($k, $d + 1), __ptv($x, $d + 1));
        }
        return array('r' => $id, 'o' => $isList ? array('k' => 'list', 'n' => count($v), 'e' => $parts) : array('k' => 'dict', 'n' => count($v), 'm' => $parts));
    }
    if (is_object($v)) {
        $id = 'o' . spl_object_id($v);
        if ($d > 2) return array('r' => $id);
        $a = array();
        foreach ((array)$v as $k => $x) {
            if (count($a) >= 30) break;
            $name = preg_replace('/^\x00.*\x00/', '', (string)$k);
            $a[] = array($name, __ptv($x, $d + 1));
        }
        return array('r' => $id, 'o' => array('k' => 'instance', 'c' => get_class($v), 'a' => $a));
    }
    return array('t' => gettype($v), 'v' => gettype($v));
}
`

const C_PRELUDE = String.raw`#include <stdio.h>
#include <stdarg.h>
static int __pt_n = 0, __pt_on = 0, __pt_first = 0, __pt_sd = 0;
static char *__pt_st[256];
static void __pt_js(const char *s) {
    int i = 0;
    putchar('"');
    for (; s && *s && i < 200; s++, i++) {
        unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') { putchar('\\'); putchar(c); }
        else if (c == '\n') fputs("\\n", stdout);
        else if (c == '\r') fputs("\\r", stdout);
        else if (c == '\t') fputs("\\t", stdout);
        else if (c < 0x20) printf("\\u%04x", c);
        else putchar(c);
    }
    putchar('"');
}
static void __pt_b(int l, const char *f, void *fa) {
    char *p = (char *)fa;
    if (__pt_n >= 300) { __pt_on = 0; if (__pt_n++ == 300) { fputs("@@PTX@@", stdout); fflush(stdout); } return; }
    __pt_n++; __pt_on = 1;
    while (__pt_sd > 0 && __pt_st[__pt_sd - 1] < p) __pt_sd--;
    if (!(__pt_sd > 0 && __pt_st[__pt_sd - 1] == p) && __pt_sd < 256) __pt_st[__pt_sd++] = p;
    printf("@@PTS@@{\"l\":%d,\"f\":", l); __pt_js(f); printf(",\"d\":%d,\"v\":[", __pt_sd);
    __pt_first = 1;
}
static void __pt_key(const char *n) { if (!__pt_first) putchar(','); __pt_first = 0; putchar('['); __pt_js(n); putchar(','); }
static void __pt_i(const char *n, long long v) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"int\",\"v\":\"%lld\"}]", v); }
static void __pt_u(const char *n, unsigned long long v) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"int\",\"v\":\"%llu\"}]", v); }
static void __pt_d(const char *n, double v) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"float\",\"v\":\"%g\"}]", v); }
static void __pt_ld(const char *n, long double v) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"float\",\"v\":\"%Lg\"}]", v); }
static void __pt_bo(const char *n, int v) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"bool\",\"v\":\"%s\"}]", v ? "true" : "false"); }
static void __pt_c(const char *n, int v) { char s[4]; if (!__pt_on) return; s[0] = '\''; s[1] = (char)v; s[2] = '\''; s[3] = 0; __pt_key(n); printf("{\"t\":\"char\",\"v\":"); __pt_js(s); printf("}]"); }
static void __pt_s(const char *n, const char *v) { if (!__pt_on) return; __pt_key(n); if (!v) printf("{\"t\":\"NoneType\",\"v\":\"NULL\"}]"); else { printf("{\"t\":\"str\",\"v\":"); __pt_js(v); printf("}]"); } }
static void __pt_x(const char *n, ...) { if (!__pt_on) return; __pt_key(n); printf("{\"t\":\"?\",\"v\":\"...\"}]"); }
static void __pt_e(void) { if (!__pt_on) return; printf("]}@@PTE@@"); fflush(stdout); }
#define __PT_V(n, x) _Generic((x), _Bool: __pt_bo, char: __pt_c, signed char: __pt_c, unsigned char: __pt_c, short: __pt_i, unsigned short: __pt_u, int: __pt_i, unsigned int: __pt_u, long: __pt_i, unsigned long: __pt_u, long long: __pt_i, unsigned long long: __pt_u, float: __pt_d, double: __pt_d, long double: __pt_ld, char *: __pt_s, const char *: __pt_s, default: __pt_x)(n, x)
#define __PT_ARR(n, a, len, fmt, cast, ty) do { if (__pt_on) { int __k; __pt_key(n); printf("{\"r\":\"%p\",\"o\":{\"k\":\"list\",\"n\":%d,\"e\":[", (void *)(a), (int)(len)); for (__k = 0; __k < (int)(len) && __k < 50; __k++) { if (__k) putchar(','); printf("{\"t\":\"" ty "\",\"v\":\"" fmt "\"}", (cast)(a)[__k]); } printf("]}}]"); } } while (0)
#define __PT_AI(n, a, len) __PT_ARR(n, a, len, "%lld", long long, "int")
#define __PT_AU(n, a, len) __PT_ARR(n, a, len, "%llu", unsigned long long, "int")
#define __PT_AD(n, a, len) __PT_ARR(n, a, len, "%g", double, "float")
`

const CPP_PRELUDE = String.raw`#include <iostream>
#include <string>
#include <sstream>
#include <cstring>
#include <cstdio>
#include <type_traits>
#include <iterator>
#include <utility>
namespace __pt {
static int n = 0, on = 0, first = 0, sd = 0;
static char *st[256];
inline void js(const std::string &s0) {
    std::string s = s0.size() > 200 ? s0.substr(0, 200) + "..." : s0;
    std::cout << '"';
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') std::cout << '\\' << (char)c;
        else if (c == '\n') std::cout << "\\n";
        else if (c == '\r') std::cout << "\\r";
        else if (c == '\t') std::cout << "\\t";
        else if (c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); std::cout << b; }
        else std::cout << (char)c;
    }
    std::cout << '"';
}
inline void b(int l, const char *f, void *fa) {
    char *p = (char *)fa;
    if (n >= 300) { on = 0; if (n++ == 300) { std::cout << "@@PTX@@"; std::cout.flush(); } return; }
    n++; on = 1;
    while (sd > 0 && st[sd - 1] < p) sd--;
    if (!(sd > 0 && st[sd - 1] == p) && sd < 256) st[sd++] = p;
    std::cout << "@@PTS@@{\"l\":" << l << ",\"f\":"; js(f); std::cout << ",\"d\":" << sd << ",\"v\":[";
    first = 1;
}
template <class T, class = void> struct iterable : std::false_type {};
template <class T> struct iterable<T, std::void_t<decltype(std::begin(std::declval<const T &>())), decltype(std::end(std::declval<const T &>()))>> : std::true_type {};
template <class T, class = void> struct maplike : std::false_type {};
template <class T> struct maplike<T, std::void_t<typename T::mapped_type>> : std::true_type {};
template <class T> struct pairlike : std::false_type {};
template <class A, class B> struct pairlike<std::pair<A, B>> : std::true_type {};
inline void prim(const char *t, const std::string &v) { std::cout << "{\"t\":\"" << t << "\",\"v\":"; js(v); std::cout << "}"; }
template <class T> std::string num(const T &x) { std::ostringstream o; o << x; return o.str(); }
inline std::string addr(const void *p) { std::ostringstream o; o << p; return o.str(); }
template <class T> void val(const T &x, int d);
template <class It> void items(It b, It e, size_t n, int d, const char *kind) {
    std::cout << "{\"k\":\"" << kind << "\",\"n\":" << n << ",\"e\":[";
    int i = 0;
    for (; b != e && i < 50; ++b, ++i) { if (i) std::cout << ','; val(*b, d + 1); }
    std::cout << "]}";
}
template <class T> void val(const T &x, int d) {
    using U = std::remove_cv_t<std::remove_reference_t<T>>;
    if constexpr (std::is_array_v<U>) {
        using E = std::remove_cv_t<std::remove_extent_t<U>>;
        if constexpr (std::is_same_v<E, char>) prim("str", std::string(x, strnlen(x, std::extent_v<U>)));
        else {
            std::cout << "{\"r\":\"" << addr(&x) << "\"";
            if (d > 2) { std::cout << "}"; return; }
            std::cout << ",\"o\":"; items(std::begin(x), std::end(x), std::extent_v<U>, d, "list"); std::cout << "}";
        }
    } else if constexpr (std::is_same_v<U, bool>) prim("bool", x ? "true" : "false");
    else if constexpr (std::is_same_v<U, char>) prim("char", std::string("'") + x + "'");
    else if constexpr (std::is_integral_v<U>) prim("int", std::to_string(x));
    else if constexpr (std::is_floating_point_v<U>) prim("float", num(x));
    else if constexpr (std::is_same_v<U, std::string>) prim("str", x);
    else if constexpr (std::is_same_v<U, const char *> || std::is_same_v<U, char *>) { if (x) prim("str", x); else prim("NoneType", "nullptr"); }
    else if constexpr (std::is_pointer_v<U>) { if (!x) prim("NoneType", "nullptr"); else prim("ptr", addr((const void *)x)); }
    else if constexpr (pairlike<U>::value) {
        std::cout << "{\"r\":\"" << addr(&x) << "\",\"o\":{\"k\":\"tuple\",\"n\":2,\"e\":["; val(x.first, d + 1); std::cout << ','; val(x.second, d + 1); std::cout << "]}}";
    } else if constexpr (maplike<U>::value) {
        std::cout << "{\"r\":\"" << addr(&x) << "\"";
        if (d > 2) { std::cout << "}"; return; }
        std::cout << ",\"o\":{\"k\":\"dict\",\"n\":" << x.size() << ",\"m\":[";
        int i = 0;
        for (auto it = x.begin(); it != x.end() && i < 50; ++it, ++i) { if (i) std::cout << ','; std::cout << '['; val(it->first, d + 1); std::cout << ','; val(it->second, d + 1); std::cout << ']'; }
        std::cout << "]}}";
    } else if constexpr (iterable<U>::value) {
        std::cout << "{\"r\":\"" << addr(&x) << "\"";
        if (d > 2) { std::cout << "}"; return; }
        size_t cnt = 0; for (auto it = std::begin(x); it != std::end(x); ++it) cnt++;
        std::cout << ",\"o\":"; items(std::begin(x), std::end(x), cnt, d, "list"); std::cout << "}";
    } else {
        std::cout << "{\"r\":\"" << addr(&x) << "\",\"o\":{\"k\":\"object\",\"c\":\"object\",\"s\":\"...\"}}";
    }
}
template <class T> void v(const char *nm, const T &x) { if (!on) return; if (!first) std::cout << ','; first = 0; std::cout << '['; js(nm); std::cout << ','; val(x, 0); std::cout << ']'; }
inline void e() { if (!on) return; std::cout << "]}@@PTE@@"; std::cout.flush(); }
}
`

const RUBY = String.raw`require 'json'
$stdout.sync = true
$__pt_n = 0
$__pt_live = {}
$__pt_src = '__B64__'.unpack('m')[0].force_encoding('UTF-8')
def __pt_v(x, d)
  case x
  when nil then { t: 'NoneType', v: 'nil' }
  when true, false then { t: 'bool', v: x.to_s }
  when Integer then { t: 'int', v: x.to_s }
  when Float then { t: 'float', v: x.to_s }
  when String then { t: 'str', v: x.length > 200 ? x[0, 200] + '...' : x }
  when Symbol then { t: 'symbol', v: ':' + x.to_s }
  else
    id = 'r' + x.object_id.to_s
    return { r: id } if d > 2
    o = case x
        when Array then { k: 'list', n: x.size, e: x.first(50).map { |y| __pt_v(y, d + 1) } }
        when Hash then { k: 'dict', n: x.size, m: x.first(50).map { |a, b| [__pt_v(a, d + 1), __pt_v(b, d + 1)] } }
        when Range, Proc, Method, IO then { k: 'object', c: x.class.name.to_s, s: x.inspect[0, 200] }
        else
          iv = x.instance_variables
          if iv.empty?
            { k: 'object', c: x.class.name.to_s, s: x.inspect[0, 200] }
          else
            { k: 'instance', c: x.class.name.to_s, a: iv.first(30).map { |n| [n.to_s, __pt_v(x.instance_variable_get(n), d + 1)] } }
          end
        end
    { r: id, o: o }
  end
end
$__pt_tp = TracePoint.new(:line) do |tp|
  next unless tp.path == '(main)'
  if $__pt_n >= 300
    if $__pt_n == 300
      $__pt_n += 1
      $stdout.write('@@PTX@@')
    end
    next
  end
  $__pt_n += 1
  begin
    b = tp.binding
    # Ruby creates every local of a scope up front (as nil); show one only
    # once it has held a value, like the other languages.
    vars = []
    b.local_variables.each do |n|
      next if n.to_s.start_with?('__pt')
      val = b.local_variable_get(n)
      $__pt_live[n] = true unless val.nil?
      vars << [n.to_s, __pt_v(val, 0)] if $__pt_live[n] && vars.size < 20
    end
    d = caller_locations.count { |c| c.path == '(main)' }
    f = if tp.method_id then tp.method_id.to_s
        elsif tp.self.is_a?(Module) then 'class ' + tp.self.to_s
        elsif d > 1 then 'block'
        else '<main>'
        end
    $stdout.write('@@PTS@@' + JSON.generate({ l: tp.lineno, f: f, d: d, v: vars }) + '@@PTE@@')
  rescue StandardError
  end
end
$__pt_tp.enable
begin
  eval($__pt_src, TOPLEVEL_BINDING, '(main)', 1)
ensure
  $__pt_tp.disable
end
`

const toBase64 = (s: string): string => {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return btoa(bin)
}

// Page language id → instrumenter language. The live compiler page offers
// java/c/cpp/csharp; the instrumenter also knows a few more languages for
// when they are added to the compiler service.
const ILANG: Record<string, ILang> = { java: 'java', c: 'c', cpp: 'cpp', csharp: 'csharp', nodejs: 'nodejs', go: 'go', kotlin: 'kotlin', php: 'php' }

export type TracedProgram = { ok: true; script: string } | { ok: false; error: string }

export function buildTracedProgram(language: string, source: string): TracedProgram {
    if (language === 'ruby') return { ok: true, script: RUBY.replace('__B64__', toBase64(source)) }
    const lang = ILANG[language]
    if (!lang) return { ok: false, error: 'This language has no visualizer yet.' }
    let result
    try { result = instrument(source, lang) } catch (e) { return { ok: false, error: `Could not read the program: ${(e as Error).message}` } }
    if (result.traced === 0) return { ok: false, error: 'Found no statements to step through. Is the code inside a function (for example main)?' }
    const code = result.code
    switch (lang) {
        case 'java': return { ok: true, script: code + '\n' + JAVA }
        case 'kotlin': return { ok: true, script: code + '\n' + KOTLIN }
        case 'csharp': return { ok: true, script: code + '\n' + CSHARP }
        case 'nodejs': return { ok: true, script: code + '\n' + JS }
        case 'c': return { ok: true, script: C_PRELUDE + '#line 1\n' + code }
        case 'cpp': return { ok: true, script: CPP_PRELUDE + '#line 1\n' + code }
        case 'php': return { ok: true, script: code + (/\?>\s*$/.test(code) ? '\n<?php\n' : '\n') + PHP }
        case 'go': {
            const m = /^([ \t]*package[ \t]+main\b[^\n]*)/m.exec(code)
            if (!m) return { ok: false, error: 'A Go program needs `package main`.' }
            return { ok: true, script: code.slice(0, m.index) + m[1].replace(/\s*$/, '') + '; ' + GO_IMPORTS + code.slice(m.index + m[1].length) + '\n' + GO }
        }
    }
}

// Lines that read input: when the program stops on one of these, the
// visualizer asks for a value.
export const INPUT_LINE: Record<string, RegExp> = {
    java: /\.(next(Int|Line|Double|Long|Float|Boolean|Short|Byte)?|readLine|read)\s*\(|\bhasNext/,
    c: /\b(scanf|fgets|gets|getchar|getline|fscanf)\s*\(/,
    cpp: /\bcin\s*>>|\bgetline\s*\(|\b(scanf|getchar)\s*\(/,
    csharp: /Console\.(ReadLine|Read|ReadKey)\s*\(/,
    nodejs: /\.question\s*\(|\bprompt\s*\(|\.on\s*\(\s*['"]line/,
    go: /\bScan(f|ln)?\s*\(|\.Read(String|Line|Rune)?\s*\(|\.Scan\s*\(/,
    kotlin: /\breadLine\s*\(|\breadln(OrNull)?\s*\(|\.next\w*\s*\(/,
    php: /\b(fgets|fscanf|readline|stream_get_line|fgetc)\s*\(/,
    ruby: /\bgets\b|\breadline\b|STDIN\.read/,
}
