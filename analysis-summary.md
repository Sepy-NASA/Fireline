# Task Analysis & Beginner-Friendly Data Ideas

## Short summary

The challenge is to make NASA’s microgravity combustion research easier to find, compare, and understand for spacecraft and future Moon/Mars habitats. The brief frames the work around three fire-safety needs:

- **Prevention:** understand when materials and fuels ignite or continue burning, especially as oxygen level and airflow change.
- **Detection:** understand smoke and aerosol measurements, including how smoke can be distinguished from dust.
- **Suppression:** understand how agents such as carbon dioxide and helium affect flames.

The supplied files are a task brief and a list of background resources. They do **not** include experiment tables or measurements. The first real analysis step is therefore to inspect the NASA PSI repository and learn what formats, fields, and data are actually available. Don’t assume every investigation has directly comparable numeric data.

## What you can do with the data

1. **Build an investigation catalog.** Make a plain-language index of studies: what question each asked, what was burned or measured, and why it may matter to fire safety.
2. **Compare test conditions.** Where the records support it, compare oxygen concentration, pressure, airflow, fuel/material, sample shape or size, gravity condition, and hardware.
3. **Find evidence by safety need.** Group studies under prevention, detection, suppression, or “indirectly relevant,” and explain the reason for each grouping.
4. **Spot patterns and gaps.** Note which conditions or materials have been studied and which appear underrepresented. Treat absence from the files you reviewed as “not found,” not proof that NASA has never studied it.
5. **Prepare data for future modeling.** Identify fields that might be useful inputs or outcomes (for example, oxygen level, flow speed, material, ignition/burning result, or measured smoke), while documenting missing values and inconsistent units.
6. **Explain relevance to future habitats.** Show why some findings may matter for higher-oxygen or lower-pressure environments. Keep this as context—not a claim that one experiment directly predicts a Moon or Mars fire.

## A manageable first project

Start with a small, understandable result rather than trying to analyze the whole repository:

1. Open the PSI combustion search and choose **three investigations** from different areas—for example BASS/Saffire (materials), SAME (smoke detection), and FLEX (suppression).
2. For each, read the experiment overview and inspect one representative dataset or report. Record its data format and what one row/file represents.
3. Create a spreadsheet with one row per investigation and these starter columns:

   `Investigation | Safety area | Research question | Fuel/material or target | Conditions | Measurements | Result/observation | Data source | Limitations`

4. Fill unknowns with `not stated` rather than guessing. Keep units exactly as given and add a separate normalized value only when you can verify the conversion.
5. Make one simple chart only if the records genuinely share a comparable variable (for example oxygen concentration across tests). Add a note about what the chart does—and does not—show.
6. Write a one-page takeaway: what you learned, which evidence supports it, and what information is missing.

## Easy analysis approaches

### 1. Investigation map (best first step)

Make a table or cards grouped by prevention, detection, and suppression. This is useful even if the data is mostly reports and descriptions rather than clean numbers. Add a confidence/evidence note so a study’s relevance is explainable rather than an unexplained ranking.

### 2. Test-condition comparison

For a single investigation, compare runs or tests that differ in one condition while keeping the other conditions in view. For instance, ask whether tests vary oxygen level, airflow, or material. Avoid comparing two studies as if they were controlled against each other unless their methods and measurements match.

### 3. Research-question search

Use consistent tags and keywords such as `material flammability`, `oxygen concentration`, `airflow`, `smoke`, `dust`, `extinguishment`, and `fuel droplet`. A simple filterable spreadsheet can make the collection much easier to navigate.

### 4. Evidence and gap review

For each possible insight, record the source, exact finding, conditions, and caveat. Then list questions the available data cannot answer. This is safer and more useful than making broad claims from a few tests.

## Beginner-friendly tools (no app required)

- **Google Sheets or Microsoft Excel:** inventory files, clean small tables, filter and sort, make basic charts, and compare study metadata.
- **Google Drive or a local folder plus a notes document:** keep source reports, extracted notes, and citations organized.
- **OpenRefine (optional):** clean inconsistent text labels or categories in a CSV (for example, alternate spellings of the same material). It is not a substitute for understanding the experiment.
- **NASA repository pages and experiment guides:** start with the investigation descriptions linked in `data-links.md`; use the PSI record itself as the source for dataset details.
- **A spreadsheet chart or Flourish/Datawrapper (optional):** make a simple static chart after the data has been checked. You do not need to build a dashboard for the first analysis.
- **Google Colab (optional, later):** a browser-based place to try a small Python notebook if files are too large or numerous for a spreadsheet. It is entirely optional for an initial inventory.

## Important cautions from the brief

- Experiments use different fuels, hardware, sensors, goals, and conditions; a shared label like “combustion” does not make their results directly comparable.
- Preserve experimental context and units. A result without oxygen level, pressure, flow, geometry, or method may be easy to misinterpret.
- The brief says partial-gravity combustion data is not currently available in PSI, although some electric-field work mimics aspects of partial gravity. Do not describe that as actual lunar-gravity testing.
- High-oxygen tests and spacesuit/habitat conditions are important context, but a lab result is not by itself a safety limit or operational recommendation.
- Separate measured findings from your interpretation. Cite the exact PSI record or NASA report for every substantive claim.

## Suggested next step

Use `data-links.md` to open the PSI combustion search, then inspect a few records and note their file formats and available metadata. Once you know whether the useful records are tables, PDFs, images, or a mixture, choose the simplest analysis method that fits—likely a spreadsheet first. The NASA guides linked in `data-links.md` can help translate experiment names and terminology before you compare results.
