# Browser checks

Serve `1-intro` on port 4180, then run these checks from this directory:

```sh
npm install
npx playwright install chromium
npm test
```

Set `LABS_URL` to test another server and `CHROME_PATH` to use an installed Chrome binary. Reports and screenshots go to `/tmp`.

The interaction checks cover metric invariants, the ROC operating point, the constant-negative baseline, stored comparisons, regression outliers and R², bilingual prompt interpretation, custom prompt preservation, and the SVM reference case. The layout checks load all four labs at 1440, 390 and 360 CSS pixels, switch both languages, and reject JavaScript errors or page overflow. Mobile checks emulate a viewport and touch interaction; they do not replace testing on a physical phone.
