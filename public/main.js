function calculateUnsafeScore(categoryScores) {
  const scores = Object.values(categoryScores);
  return Math.max(...scores);
}

function updateUnsafeGauge(score) {
  const slider = document.getElementById('unsafeSlider');
  const valueSpan = document.getElementById('unsafeValue');
  const percent = Math.round(score * 100);
  slider.value = percent;
  valueSpan.textContent = percent + '%';
  let color;
  if (score < 0.3) color = '#1b7e3c';      // green
  else if (score < 0.7) color = '#f7b500'; // yellow
  else color = '#d7263d';                  // red
  slider.style.accentColor = color;
  valueSpan.style.color = color;
}

const form = document.getElementById('moderationForm');
const resultDiv = document.getElementById('result');
let lastResults = {
  main: null,
  OpenAI: null,
  Perspective: null,
  ftgpt: null
};

// Helper to format category names for display
function formatCategoryName(cat) {
  return cat
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function updateFlagsForThreshold(result, prefix, threshold) {
  if (!result) return;
  let categoriesHtml = '<strong>Categories:</strong><ul>';
  for (const [cat, score] of Object.entries(result.category_scores)) {
    const flagged = score >= threshold;
    categoriesHtml += `<li>${formatCategoryName(cat)}: <strong>${flagged ? '🚩' : '✅'}</strong></li>`;
  }
  categoriesHtml += '</ul>';
  document.getElementById(`categories${prefix}`).innerHTML = categoriesHtml;
}

function renderMainVerdictAndFlags(data, threshold) {
  // Determine if any category is flagged at this threshold
  const flagged = Object.values(data.category_scores).some(score => score >= threshold);
  let verdict = flagged
    ? `<span>⚠️ Comment Failed</span>`
    : `<span>✅ Comment Passed</span>`;
  let verdictDiv = document.getElementById('verdictmain');
  if (!verdictDiv) {
    verdictDiv = document.createElement('div');
    verdictDiv.id = 'verdictmain';
    verdictDiv.className = 'verdict';
    resultDiv.prepend(verdictDiv);
  }
  verdictDiv.innerHTML = verdict;
  verdictDiv.className = 'verdict ' + (flagged ? 'not-ok' : 'ok');
  let scoresHtml = '<div class="scores"><strong>Scores:</strong><ul>';
  for (const [cat, score] of Object.entries(data.category_scores)) {
    scoresHtml += `<li>${formatCategoryName(cat)}: ${(score * 100).toFixed(0)}%</li>`;
  }
  scoresHtml += '</ul></div>';
  // Render verdict, categories, and scores
  resultDiv.innerHTML = verdictDiv.outerHTML + `<div class="categories" id="categoriesmain"></div>` + scoresHtml;
  updateFlagsForThreshold(data, 'main', threshold);
}

document.addEventListener('DOMContentLoaded', function() {
  const compareBtn = document.getElementById('compareBtn');
  const comparisonSection = document.getElementById('comparison');

  if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
      const comment = document.getElementById('comment').value;
      if (!comment.trim()) {
        alert('Please enter a comment to compare.');
        return;
      }
      // Fetch all three APIs in parallel
      const [openai, perspective, ftgpt] = await Promise.all([
        fetch('/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment, moderator: 'openai' })
        }).then(res => res.json()),
        fetch('/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment, moderator: 'perspectiveapi' })
        }).then(res => res.json()),
        fetch('/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment, moderator: 'ft-gpt' })
        }).then(res => res.json())
      ]);

      lastResults.OpenAI = openai;
      lastResults.Perspective = perspective;
      lastResults.ftgpt = ftgpt;

      // Helper to update a card (now only for flags and scores)
      function updateCard(data, prefix, threshold) {
        if (!data || data.error) {
          const scoresContainer = document.getElementById(`categoriesScores${prefix}`);
          if (scoresContainer) {
            scoresContainer.innerHTML = `<span class='not-ok'>❌ Error: ${data?.error || 'No response'}</span>`;
          }
          const verdictDiv = document.getElementById(`verdict${prefix}`);
          if (verdictDiv) verdictDiv.innerHTML = '';
          return;
        }
        // Verdict
        const flagged = Object.values(data.category_scores).some(score => score >= threshold);
        let verdict = flagged
          ? `<span>⚠️ Comment Failed</span>`
          : `<span>✅ Comment Passed</span>`;
        const verdictDiv = document.getElementById(`verdict${prefix}`);
        if (verdictDiv) {
          verdictDiv.innerHTML = verdict;
          verdictDiv.className = 'verdict ' + (flagged ? 'not-ok' : 'ok');
        }
        // Scores & flags
        const scoresContainer = document.getElementById(`categoriesScores${prefix}`);
        if (scoresContainer) {
          const ul = scoresContainer.querySelector('ul');
          if (ul) {
            // Animate each score from its current value to the new value
            // Build a map of current displayed values
            const currentScores = {};
            ul.querySelectorAll('li').forEach(li => {
              const text = li.textContent || '';
              const match = text.match(/([\d]+)%/);
              if (match) {
                // Try to extract the category name as well
                const catMatch = text.match(/^[^\w]*([\w\-/ ]+):/i);
                if (catMatch) {
                  currentScores[catMatch[1].trim().toLowerCase()] = parseInt(match[1], 10);
                }
              }
            });
            ul.innerHTML = '';
            for (const [cat, score] of Object.entries(data.category_scores)) {
              const flagged = score >= threshold;
              const percent = Math.round(score * 100);
              const catLabel = formatCategoryName(cat);
              const li = document.createElement('li');
              li.innerHTML = `<strong>${flagged ? '🚩' : '✅'}</strong> ${catLabel}: <span class=\"score\">0%</span>`;
              ul.appendChild(li);
              const span = li.querySelector('span.score');
              // Use the current displayed value if available, otherwise start from 0
              const current = currentScores[catLabel.toLowerCase()] ?? 0;
              animateScore(span, current, percent);
            }
          }
        }
      }

      // Set up shared slider (if present)
      const comparisonSlider = document.getElementById('comparisonSlider');
      const comparisonValue = document.getElementById('comparisonValue');
      function updateAllComparisonFlags() {
        const threshold = comparisonSlider && comparisonSlider.value ? comparisonSlider.value / 100 : 0.5;
        if (comparisonValue && comparisonSlider) comparisonValue.textContent = comparisonSlider.value + '%';
        updateCard(lastResults.OpenAI, 'OpenAI', threshold);
        updateCard(lastResults.Perspective, 'Perspective', threshold);
        updateCard(lastResults.ftgpt, 'ftgpt', threshold);
        // Update slider color
        if (comparisonSlider && comparisonValue) {
          let color;
          if (threshold > 0.7) color = '#1b7e3c';
          else if (threshold > 0.3) color = '#f7b500';
          else color = '#d7263d';
          comparisonSlider.style.accentColor = color;
          comparisonValue.style.color = color;
        }
      }
      if (comparisonSlider && comparisonValue) {
        comparisonSlider.oninput = updateAllComparisonFlags;
        updateAllComparisonFlags();
      } else {
        // If no slider, just update once at default threshold
        updateAllComparisonFlags();
      }
    });
  }
});

// Analysis form handler
const analysisForm = document.getElementById('analysisForm');
const analysisResultDiv = document.getElementById('analysisResult');

if (analysisForm) {
  analysisForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    analysisResultDiv.style.display = 'block';
    analysisResultDiv.innerHTML = '⏳ Analyzing...';
    const text = document.getElementById('analysisText').value;
    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.error) {
        analysisResultDiv.innerHTML = `<span class='not-ok'>❌ Error: ${data.error}</span>`;
        return;
      }
      // Display analysis
      const themes = Array.isArray(data.themes) ? data.themes.join(', ') : data.themes;
      const tone = data.tone || 'Unknown';
      const sensitivity = typeof data.sensitivity === 'number' ? Math.round(data.sensitivity) : 'N/A';
      analysisResultDiv.innerHTML = `
        <div><strong>Themes:</strong> ${themes}</div>
        <div><strong>Emotional Tone:</strong> ${tone}</div>
        <div><strong>Sensitivity Score:</strong> <span id="sensitivityScore">${sensitivity}%</span></div>
      `;
      // Set unsafe score threshold slider automatically
      const unsafeSlider = document.getElementById('unsafeSlider');
      const unsafeValue = document.getElementById('unsafeValue');
      if (unsafeSlider && unsafeValue && typeof data.sensitivity === 'number') {
        const thresholdValue = 100 - Math.round(data.sensitivity);
        // Animate the slider value
        const startValue = parseInt(unsafeSlider.value, 10);
        const endValue = thresholdValue;
        const duration = 500; // ms
        const startTime = performance.now();
        function animateSlider(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentValue = Math.round(startValue + (endValue - startValue) * progress);
          unsafeSlider.value = currentValue;
          unsafeValue.textContent = currentValue + '%';
          if (typeof unsafeSlider.oninput === 'function') {
            unsafeSlider.oninput.call(unsafeSlider);
          }
          if (progress < 1) {
            requestAnimationFrame(animateSlider);
          }
        }
        requestAnimationFrame(animateSlider);
      }
      // Update slider color on manual input as well
      if (unsafeSlider) {
        // Set initial value on page load
        unsafeValue.textContent = unsafeSlider.value + '%';
        unsafeSlider.oninput = function() {
          const val = parseInt(this.value, 10);
          unsafeValue.textContent = val + '%';
        };
      }
      // Also update setSliderColor for animation
      function setSliderColor(val) {
        // No color changes
      }
    } catch (err) {
      analysisResultDiv.innerHTML = `<span class='not-ok'>❌ Error occurred</span>`;
    }
  });
}

// Ensure slider % updates live on page load
const unsafeSlider = document.getElementById('unsafeSlider');
const unsafeValue = document.getElementById('unsafeValue');
if (unsafeSlider && unsafeValue) {
  unsafeValue.textContent = unsafeSlider.value + '%';
  unsafeSlider.oninput = function() {
    const val = parseInt(this.value, 10);
    unsafeValue.textContent = val + '%';
  };
}

function animateScore(span, start, end) {
  const duration = 500; // ms
  const step = start < end ? 1 : -1;
  const totalSteps = Math.abs(end - start);
  if (totalSteps === 0) {
    span.textContent = end + '%';
    return;
  }
  let current = start;
  let startTime = null;
  function animate(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const target = Math.round(start + (end - start) * progress);
    if (target !== current) {
      current = target;
      span.textContent = current + '%';
    }
    if ((step > 0 && current < end) || (step < 0 && current > end)) {
      requestAnimationFrame(animate);
    } else {
      span.textContent = end + '%';
    }
  }
  requestAnimationFrame(animate);
}