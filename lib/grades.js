// Turns whatever a parent typed for grade into a friendly label:
// "4" or "4th" -> "4th grade", "K" -> "Kindergarten", "pre-k" -> "PreK".
const ORD = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function gradeLabel(raw) {
  const g = String(raw || "").trim();
  if (!g) return "";
  const k = g.toLowerCase().replace(/[\s.\-]/g, "");
  if (["k", "kg", "kinder", "kindergarten", "kindy"].includes(k)) return "Kindergarten";
  if (["prek", "pk", "prekindergarten", "preschool", "pre"].includes(k)) return g.toLowerCase().includes("school") ? "Preschool" : "PreK";
  if (k === "tk") return "TK";
  const m = k.match(/^(?:grade)?(\d{1,2})(?:st|nd|rd|th)?(?:grade)?$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return `${ORD(n)} grade`;
  }
  return g;
}
