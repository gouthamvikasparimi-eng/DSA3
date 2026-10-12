const $ = (selector) => document.querySelector(selector);

const form = $("#scanForm");
const documentText = $("#documentText");
const referenceText = $("#referenceText");
const fileInput = $("#fileInput");
const fileName = $("#fileName");
const wordCount = $("#wordCount");
const toast = $("#toast");

let latestReport = null;
let checkedCount = 0;
let totalWordsChecked = 0;
let similaritySum = 0;
let toastTimer;

const STOP_WORDS = new Set(("a an the and or but if then else of at by for from in into on onto to up with without is are was were be been being am do does did have has had it its this that these those as not no so than too very can could will would should may might must we our you your they their he she his her i me my mine them what which who when where why how also such about over under between within across after before during through").split(" "));

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []);
}
function meaningfulTokens(text) {
  return tokenize(text).filter(word => word.length > 2 && !STOP_WORDS.has(word));
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function updateWordCount() {
  const count = tokenize(documentText.value).length;
  wordCount.textContent = `${count.toLocaleString()} word${count === 1 ? "" : "s"}`;
}
function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function setScoreRing(score) {
  const degrees = Math.round(score * 3.6);
  const color = score >= 40 ? "#ef7e99" : score >= 20 ? "#e7bd72" : "#73e3c0";
  $("#scoreRing").style.background = `conic-gradient(${color} ${degrees}deg, #222a43 ${degrees}deg)`;
}
function analyze(submission, reference) {
  const submitted = meaningfulTokens(submission);
  const referenceWords = new Set(meaningfulTokens(reference));
  const uniqueSubmitted = new Set(submitted);
  const matches = [...uniqueSubmitted].filter(word => referenceWords.has(word));
  const score = uniqueSubmitted.size ? Math.round(matches.length / uniqueSubmitted.size * 100) : 0;
  const allSubmissionWords = tokenize(submission);
  const matchedSet = new Set(matches);
  return { score, matches, submittedCount: allSubmissionWords.length, uniqueCount: uniqueSubmitted.size, matchedSet, submission };
}
function renderResults(result, title) {
  $("#emptyState").classList.add("hidden");
  $("#resultsContent").classList.remove("hidden");
  $("#scoreValue").textContent = `${result.score}%`;
  setScoreRing(result.score);
  const status = $("#resultStatus");
  const headline = $("#resultHeadline");
  if (result.score >= 40) {
    status.textContent = "HIGH OVERLAP"; status.style.color = "#ef91a7";
    headline.textContent = "Review these passages.";
    $("#resultSummary").textContent = "A substantial amount of meaningful vocabulary overlaps with the supplied reference.";
  } else if (result.score >= 20) {
    status.textContent = "MODERATE OVERLAP"; status.style.color = "#e7bd72";
    headline.textContent = "Take a closer look.";
    $("#resultSummary").textContent = "Some vocabulary overlaps. Review the context and make sure sources are cited.";
  } else {
    status.textContent = "LOW OVERLAP"; status.style.color = "#73e3c0";
    headline.textContent = "A promising start.";
    $("#resultSummary").textContent = "Relatively little meaningful vocabulary overlaps with the supplied reference.";
  }
  $("#matchedWords").textContent = result.matches.length.toLocaleString();
  $("#submissionWords").textContent = result.submittedCount.toLocaleString();
  $("#overlapPercent").textContent = `${result.score}%`;
  $("#matchCount").textContent = `${result.matches.length} term${result.matches.length === 1 ? "" : "s"}`;
  const terms = $("#matchedTerms");
  terms.innerHTML = "";
  if (!result.matches.length) {
    terms.innerHTML = '<span class="muted-text">No shared meaningful terms found.</span>';
  } else {
    result.matches.slice(0, 36).forEach(word => {
      const chip = document.createElement("span");
      chip.className = "term-chip";
      chip.textContent = word;
      terms.appendChild(chip);
    });
    if (result.matches.length > 36) {
      const extra = document.createElement("span");
      extra.className = "term-chip";
      extra.textContent = `+${result.matches.length - 36} more`;
      terms.appendChild(extra);
    }
  }
  const highlighted = escapeHtml(result.submission).replace(/\n/g, "<br>");
  const highlightedHtml = highlighted.replace(/[A-Za-z0-9][A-Za-z0-9'-]*/g, word => {
    return result.matchedSet.has(word.toLowerCase()) ? `<mark>${word}</mark>` : word;
  });
  $("#highlightedText").innerHTML = highlightedHtml;
  latestReport = {
    title: title || "Untitled document",
    date: new Date().toLocaleString(),
    ...result
  };
  checkedCount++;
  totalWordsChecked += result.submittedCount;
  similaritySum += result.score;
  $("#documentsChecked").textContent = checkedCount.toLocaleString();
  $("#wordsAnalyzed").textContent = totalWordsChecked.toLocaleString();
  $("#averageSimilarity").textContent = `${Math.round(similaritySum / checkedCount)}%`;
  $("#averageLabel").textContent = "session avg.";
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const submission = documentText.value.trim();
  const reference = referenceText.value.trim();
  if (!submission || !reference) {
    notify("Please add both your submission and reference text.");
    return;
  }
  if (tokenize(submission).length < 3) {
    notify("Please enter a little more text to analyze.");
    return;
  }
  renderResults(analyze(submission, reference), $("#studentName").value.trim());
  notify("Analysis complete. Review the results on the right.");
  if (window.innerWidth < 900) $("#reports").scrollIntoView({ behavior: "smooth", block: "start" });
});
documentText.addEventListener("input", updateWordCount);
fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    notify("This file is larger than 2 MB.");
    fileInput.value = "";
    return;
  }
  if (!file.name.toLowerCase().endsWith(".txt")) {
    notify("Please select a .txt file.");
    fileInput.value = "";
    return;
  }
  documentText.value = await file.text();
  fileName.textContent = file.name;
  updateWordCount();
  notify("Text file loaded successfully.");
});
$("#clearText").addEventListener("click", () => {
  documentText.value = "";
  fileInput.value = "";
  fileName.textContent = "TXT files up to 2 MB";
  updateWordCount();
  documentText.focus();
});
$("#downloadReport").addEventListener("click", () => {
  if (!latestReport) return notify("Run an analysis before downloading a report.");
  const report = [
    "VERITY — PLAGIARISM SIMILARITY REPORT",
    "======================================",
    `Document: ${latestReport.title}`,
    `Generated: ${latestReport.date}`,
    "",
    `Similarity score: ${latestReport.score}%`,
    `Matched meaningful terms: ${latestReport.matches.length}`,
    `Submission word count: ${latestReport.submittedCount}`,
    `Shared vocabulary: ${latestReport.matches.join(", ") || "None found"}`,
    "",
    "SUBMISSION TEXT",
    "---------------",
    latestReport.submission,
    "",
    "IMPORTANT LIMITATION",
    "This report compares text only with the reference supplied by the user. It does not search the internet, academic repositories, or external databases. Similarity is not proof of plagiarism."
  ].join("\n");
  const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "verity-similarity-report.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  notify("Your report has been downloaded.");
});
updateWordCount();
