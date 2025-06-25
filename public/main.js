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
  Perspective: null
};

function updateFlagsForThreshold(result, prefix, threshold) {
  if (!result) return;
  let categoriesHtml = '<strong>Categories:</strong><ul>';
  for (const [cat, score] of Object.entries(result.category_scores)) {
    const flagged = score >= threshold;
    categoriesHtml += `<li>${cat}: <strong>${flagged ? '🚩' : '✅'}</strong></li>`;
  }
  categoriesHtml += '</ul>';
  document.getElementById(`categories${prefix}`).innerHTML = categoriesHtml;
}

function renderMainVerdictAndFlags(data, threshold) {
  // Determine if any category is flagged at this threshold
  const flagged = Object.values(data.category_scores).some(score => score >= threshold);
  let verdict = flagged
    ? `<span>⚠️ Comment is NOT OK — please revise</span>`
    : `<span>✅ Comment is OK</span>`;
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
    scoresHtml += `<li>${cat}: ${score.toFixed(3)}</li>`;
  }
  scoresHtml += '</ul></div>';
  // Render verdict, categories, and scores
  resultDiv.innerHTML = verdictDiv.outerHTML + `<div class="categories" id="categoriesmain"></div>` + scoresHtml;
  updateFlagsForThreshold(data, 'main', threshold);
}

const compareBtn = document.getElementById('compareBtn');
const comparisonSection = document.getElementById('comparison');

compareBtn.addEventListener('click', async () => {
  const comment = document.getElementById('comment').value;
  if (!comment.trim()) {
    alert('Please enter a comment to compare.');
    return;
  }
  // Do NOT clear or overwrite the comparisonSection.innerHTML
  // Only update the flags and scores in the existing cards

  // Fetch both APIs in parallel
  const [openai, perspective] = await Promise.all([
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'openai' })
    }).then(res => res.json()),
    fetch('/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, moderator: 'perspectiveapi' })
    }).then(res => res.json())
  ]);

  lastResults.OpenAI = openai;
  lastResults.Perspective = perspective;

  // Helper to update only the flags and scores in the merged categories-scores section
  function updateCardFlagsAndScores(data, prefix, threshold) {
    if (!data || data.error) {
      document.getElementById(`categoriesScores${prefix}`).innerHTML = `<span class='not-ok'>❌ Error: ${data?.error || 'No response'}</span>`;
      document.getElementById(`verdict${prefix}`).innerHTML = '';
      return;
    }
    // Verdict
    const flagged = Object.values(data.category_scores).some(score => score >= threshold);
    let verdict = flagged
      ? `<span>⚠️ Comment is NOT OK — please revise</span>`
      : `<span>✅ Comment is OK</span>`;
    const verdictDiv = document.getElementById(`verdict${prefix}`);
    verdictDiv.innerHTML = verdict;
    verdictDiv.className = 'verdict ' + (flagged ? 'not-ok' : 'ok');
    // Update only the flags and scores in the merged categories-scores section
    const categoriesScoresDiv = document.getElementById(`categoriesScores${prefix}`);
    if (!categoriesScoresDiv) return;
    const lis = categoriesScoresDiv.querySelectorAll('ul > li');
    lis.forEach(li => {
      // Extract category name from the text node (after the flag)
      const text = li.textContent;
      // Try to match the category name (case-insensitive, ignore spaces/underscores)
      const match = text.match(/\s([\w\-/]+):/);
      if (!match) return;
      const cat = match[1];
      // Find the actual category in the data (case-insensitive, ignore spaces/underscores)
      const dataCat = Object.keys(data.category_scores || {}).find(k =>
        k.replace(/[_\s]/g, '').toLowerCase() === cat.replace(/[_\s]/g, '').toLowerCase()
      );
      const score = data.category_scores?.[dataCat] ?? 0;
      const isFlagged = score >= threshold;
      // Update the flag
      const strong = li.querySelector('strong');
      if (strong) strong.textContent = isFlagged ? '🚩' : '✅';
      // Update the score and animate the whole li
      const scoreSpan = li.querySelector('.score');
      if (scoreSpan) {
        const prevPercent = parseInt(scoreSpan.textContent.replace('%', ''), 10) || 0;
        const newPercent = Math.round(score * 100);
        if (prevPercent !== newPercent) {
          // Animate the score in 1% steps, faster
          const step = prevPercent < newPercent ? 1 : -1;
          let current = prevPercent;
          const animate = () => {
            if (current !== newPercent) {
              current += step;
              scoreSpan.textContent = current + '%';
              setTimeout(animate, 8);
            } else {
              scoreSpan.textContent = newPercent + '%';
            }
          };
          animate();
        } else {
          scoreSpan.textContent = newPercent + '%';
        }
      }
    });
  }

  // Use the main comment score threshold slider value
  const unsafeSlider = document.getElementById('unsafeSlider');
  function getThreshold() {
    return unsafeSlider.value / 100;
  }
  function updateAllComparisonFlags() {
    const threshold = getThreshold();
    updateCardFlagsAndScores(lastResults.OpenAI, 'OpenAI', threshold);
    updateCardFlagsAndScores(lastResults.Perspective, 'Perspective', threshold);
  }
  // Listen for changes to the main slider
  unsafeSlider.addEventListener('input', updateAllComparisonFlags);
  // Initial update
  updateAllComparisonFlags();
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