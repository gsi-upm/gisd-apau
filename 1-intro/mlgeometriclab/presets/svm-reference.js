(function (global) {
  'use strict';

  const preset = Object.freeze({
    id: 'svm-reference-label-noise-30',
    name: 'SVM · ruido de etiquetas',
    description: 'Caso reproducible para estudiar regularización con 30% de etiquetas de entrenamiento alteradas.',

    dataset: Object.freeze({
      type: 'linear',
      seed: 65,
      nSamples: 120,
      split: Object.freeze({
        train: 0.70,
        test: 0.30,
        stratifiedBy: 'trueClass'
      })
    }),

    labelNoise: Object.freeze({
      rate: 0.30,
      applyTo: 'train-only',
      evaluationTarget: 'trueClass',
      corruptedIndices: Object.freeze([
        3, 7, 20, 23, 32, 40, 54, 57,
        64, 68, 72, 73, 74, 81, 82, 88, 93, 96,
        102, 103, 104, 107, 115, 117, 118
      ]),
      mapping: 'binary-flip-0-1'
    }),

    model: Object.freeze({
      algorithm: 'svm',
      kernel: 'rbf',
      gamma: 1,
      cValues: Object.freeze([0.1, 1, 10]),
      initialC: 0.1
    }),

    expected: Object.freeze({
      tolerance: 0.015,
      byC: Object.freeze({
        '0.1': Object.freeze({
          f1TrainTrueClass: 0.895,
          f1TestTrueClass: 0.909,
          precisionTest: 1.000,
          recallTest: 0.833,
          interpretation: 'Mayor regularización: frontera más conservadora y estable frente al ruido.'
        }),
        '1': Object.freeze({
          f1TrainTrueClass: 0.988,
          f1TestTrueClass: 0.971,
          precisionTest: 1.000,
          recallTest: 0.944,
          interpretation: 'Mejor compromiso entre margen, ajuste y generalización.'
        }),
        '10': Object.freeze({
          f1TrainTrueClass: 0.988,
          f1TestTrueClass: 0.909,
          precisionTest: 1.000,
          recallTest: 0.833,
          interpretation: 'Mayor presión por ajustar las etiquetas observadas; el F1 de prueba empeora respecto a C=1.'
        })
      })
    }),

    teaching: Object.freeze({
      trainingMessage: 'El modelo se entrena con las etiquetas mostradas, incluidas las alteradas.',
      evaluationMessage: 'F1, precisión y recall se calculan respecto a la clase real.',
      question: '¿Por qué C=10 no mejora el F1 de prueba aunque penalice más los errores de entrenamiento?',
      takeaway: 'Un ajuste más agresivo a las etiquetas observadas no implica mejor generalización cuando parte de esas etiquetas es incorrecta.'
    })
  });

  function clonePreset() {
    return JSON.parse(JSON.stringify(preset));
  }

  function getExpectedForC(C) {
    const key = String(Number(C));
    const expected = preset.expected.byC[key];
    if (!expected) {
      throw new RangeError('C no válido para este preset. Usa 0.1, 1 o 10.');
    }
    return JSON.parse(JSON.stringify(expected));
  }

  function validateResult(C, actual, tolerance = preset.expected.tolerance) {
    const expected = getExpectedForC(C);
    const fields = [
      ['f1TrainTrueClass', 'F1 entrenamiento'],
      ['f1TestTrueClass', 'F1 prueba'],
      ['precisionTest', 'Precisión prueba'],
      ['recallTest', 'Recall prueba']
    ];

    const checks = fields.map(([field, label]) => {
      const value = Number(actual[field]);
      const target = Number(expected[field]);
      const delta = Math.abs(value - target);
      return {
        field,
        label,
        actual: value,
        expected: target,
        delta,
        pass: Number.isFinite(value) && delta <= tolerance
      };
    });

    return {
      presetId: preset.id,
      C: Number(C),
      tolerance,
      pass: checks.every(check => check.pass),
      checks
    };
  }

  function runReferenceSequence(runCase) {
    if (typeof runCase !== 'function') {
      throw new TypeError('runReferenceSequence necesita una función runCase(config) que ejecute el modelo y devuelva las métricas.');
    }

    return preset.model.cValues.map(C => {
      const config = clonePreset();
      config.model.C = C;
      const actual = runCase(config);
      return {
        C,
        actual,
        expected: getExpectedForC(C),
        validation: validateResult(C, actual)
      };
    });
  }

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
    const dataset = document.querySelector('#dataset');
    if (!dataset || typeof makeData !== 'function') return;

    dataset.value = preset.dataset.type;

    // Regenera exactamente los mismos puntos y el mismo split estratificado.
    seed = preset.dataset.seed;
    labelNoise = 0;
    makeData();

    // Sustituye el muestreo aleatorio de ruido por los índices fijados en el preset.
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

  function installPresetButton() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.querySelector('#svmReferencePreset')) return;

    const newData = document.querySelector('#newData');
    const button = document.createElement('button');
    button.id = 'svmReferencePreset';
    button.className = 'secondary-button';
    button.type = 'button';
    button.title = 'Carga el caso reproducible SVM con 30% de etiquetas incorrectas';
    button.textContent = '◎ Caso SVM';
    button.addEventListener('click', loadSvmReferencePreset);

    if (newData) newData.insertAdjacentElement('afterend', button);
    else toolbar.appendChild(button);
  }

  global.SVM_REFERENCE_PRESET = preset;
  global.getSvmReferencePreset = clonePreset;
  global.getSvmReferenceExpected = getExpectedForC;
  global.validateSvmReferenceResult = validateResult;
  global.runSvmReferenceSequence = runReferenceSequence;
  global.loadSvmReferencePreset = loadSvmReferencePreset;

  // app.js se carga después de este archivo; instalamos el botón cuando toda la página está lista.
  global.addEventListener('load', installPresetButton);
})(typeof window !== 'undefined' ? window : globalThis);
