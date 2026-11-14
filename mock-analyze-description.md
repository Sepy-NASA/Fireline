### UI Wireframe Specification: "Analyze" View

#### 1. Overall Layout & Structure
* **Canvas:** Widescreen desktop layout (`16:9` aspect ratio) on a solid white background, framed by a dark gray outer border with the frame title `"Analyze"` in the top-left corner.
* **Grid Architecture:** A top horizontal navigation bar above a three-column workspace layout:
  1. **Left Sidebar** (wide vertical panel)
  2. **Center Canvas** (interactive node-graph & detail card workspace)
  3. **Right Sidebar** (narrow vertical panel)
* **Visual Style:** Low-fidelity grayscale wireframe (`#D9D9D9` light gray containers, `#595959` dark gray list placeholders, `#8C8C8C` input bar) with one solid red CTA button (`#C94A4A`).

---

#### 2. Component Breakdown

##### A. Top Navigation Bar
* Three equal-width, light-gray horizontal rectangular tabs arranged side-by-side at the top, left-aligned with the main content area (leaving white space on the far right):
  1. **Tab 1:** `"Analyze"`
  2. **Tab 2:** `"Explore"`
  3. **Tab 3:** `"Overview"`

##### B. Left Sidebar (Chat / Prompt / Feed Panel)
* **Container:** Large vertical light-gray rectangle spanning from below the `"Analyze"` tab down to the bottom margin.
* **Bottom Element:** A medium-gray horizontal bar anchored near the bottom edge inside the panel (representing a text input box or search bar).
* **Annotation Pin (`A`):** Located at the bottom-right outer corner of this panel.

##### C. Center Workspace (Node Graph & Detail Card)
* **Info / Context Card (Left of graph):**
  * A medium-sized light-gray rectangle positioned vertically centered to the right of the Left Sidebar.
  * Left-aligned black text stacked on three lines inside the box:
    * `Characteristics`
    * `Goal`
    * `Context here`
* **Node-Link Network Graph (Right of info card):**
  * **Root/Central Node:** An irregular multi-pointed star/burst shape (light gray) acting as the hub.
    * **Annotation Pin (`A`):** Placed directly over the center of this star node.
  * **Connected Circular Nodes:** Four light-gray circles connected via thin black straight lines:
    1. **Top-Right Circle:** Connected directly to the central star node.
    2. **Bottom-Center Circle:** Connected directly to the central star node via a steep downward line.
       * **Annotation Pin (`A`):** Placed on the upper-right edge of this bottom circle.
    3. **Middle-Right Circle:** Connected directly to the central star node.
    4. **Far-Bottom-Right Circle:** Connected sequentially to the **Middle-Right Circle** (forming a 2-hop branch from the central star).

##### D. Right Sidebar (Data Sources / Layers / Actions Panel)
* **Container:** Narrow vertical light-gray rectangle aligned with the top and bottom edges of the Left Sidebar, positioned on the far right.
* **Top Section:** Six stacked dark-gray horizontal bars (`#595959`) with equal vertical spacing, representing list items, datasets, or filters.
  * **Annotation Pin (`A`):** Located at the top-right outer corner of this panel.
* **Bottom Section:** A prominent rectangular button in muted red (`#C94A4A`) with centered white text: `"Upload data"`.

---

#### 3. Summary of Annotation Markers
Four identical Figma-style comment pins (dark gray teardrop/circle badge with an orange-red circle containing the white letter `"A"`) mark specific areas for discussion or requirements:
1. Bottom-right corner of the **Left Sidebar** (near the bottom input bar).
2. Center of the **Central Star Node** in the graph.
3. Top-right edge of the **Bottom Circular Node** in the graph.
4. Top-right corner of the **Right Sidebar** (next to the top list item).