(function () {
  'use strict';

  function activateNoiseButton(rate) {
    document.querySelectorAll('#labelNoiseChoices button').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.value) === rate);
    });
  }

  function applyExactCorruption(indices) {
    points.forEach(point => {
      point.c = point.trueC;
      point.corrupted = false;
    });

    const invalid = [];
    indices.forEach(index => {
      const point = points[index];
      if (!point || !point.train) {
        invalid.push(index);
        return;
      }
      point.corrupted = true;
      point.c = point.trueC < 2 ? 1 - point.trueC : (point.trueC + 1) % 3;
    });

    if (invalid.length) {
      throw new Error('El preset SVM no coincide con el split esperado. Índices no válidos: ' + invalid.join(', '));
    }
  }

  function loadSvmReferencePreset() {
    const preset = window.SVM_REFERENCE_PRESET;
    if (!preset) {
      console.error('No se ha cargado SVM_REFERENCE_PRESET.');
      return;
    }

    const dataset = document.querySelector('#dataset');
    dataset.value = preset.dataset.type;

    // Regenera exactamente los mismos puntos y el mismo split 70/30.
    seed = preset.dataset.seed;
    labelNoise = 0;
    makeData();

    // Sustituye el muestreo de ruido por los 25 índices fijados en el preset.
    labelNoise = preset.labelNoise.rate;
    applyExactCorruption(preset.labelNoise.corruptedIndices);
    activateNoiseButton(labelNoise);

    // Configuración SVM de referencia.
    params.kernel = preset.model.kernel;
    params.gamma = preset.model.gamma;
    params.C = preset.model.initialC;
    showLabelErrors = true;

    const toggle = document.querySelector('#toggleNoise');
    if (toggle) toggle.textContent = 'Ocultar errores';

    setModel('svm');
    updateLabel();
    fit();
    evaluate();

    const generalization = document.querySelector('#generalization');
    if (generalization) {
      generalization.textContent += ' Caso reproducible: seed 65 · RBF · γ=1 · compara C=0,1 → 1 → 10.';
    }

    const insight = document.querySelector('#insight');
    if (insight) {
      insight.textContent = 'Caso SVM de referencia cargado. Mantén RBF y γ=1; cambia solo C: 0,1 → 1 → 10. El modelo aprende con 25 etiquetas alteradas y se evalúa contra la clase real.';
    }
  }

  const button = document.querySelector('#svmReferencePreset');
  if (button) button.addEventListener('click', loadSvmReferencePreset);

  window.loadSvmReferencePreset = loadSvmReferencePreset;
})();
