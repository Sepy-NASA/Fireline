# App specification
App should be mock without backend (or mock backend) but interactive examples and some state ready flow.

## Technologies
- Shadcn + Tailwind (Black theme + Blue NASA accent color)
- React with basic states
- Find good library for that canvas (or use default canvas - u decide what would be the best)
- No unnecessary tech because it is a mock

## Challenge
Your challenge is to build an SI-powered, web-based dashboard that summarizes, ranks, and interprets combustion science investigations to deliver critical foundational insights for fire safety. You may consider enabling users to:

- Identify investigations most relevant to the fire safety needs of habitable crew environments, including spacecraft, space stations, bases on the lunar and Martian surfaces, and pressurized rovers.*
- Extract data that supports predictive modeling of flammability and fire scenarios in space exploration.
- Highlight research that informs the development of next-generation fire safety controls and equipment.

## Functionalities
App should have easy accesible bookmarks (views). U can propose more complex layout.

### Analyze view
- This is starting view, after entering app we have sessions and new session starts with creating first node, as next point:
- Define starting point of research and problem(s) - description
- On the left side there is chat window, in the middle we have a canvas for graph(which should look like neo4j) and on the right side we have tools or details after clicking some node
- Easy option to add nodes as tools
- Enable to connect data from this system and external (existing data) and mcps
- One tool is more like text writing like prompt
- Conversation with agent with this whole context - agent can also add nodes(data is indexed for ai retrieval), provide interactive links, highlighting
- Define branches like if we are focus on increasing ship safety we define ship model within some links or other data
- Strict integration with Explore/Overview to give user smooth redirect to look at specific info
- There should be right panel for summary/details or 
- AI summary of added nodes on the right side, if type is data is good for summary
- On the right by default there is a list of types of nodes that can be added like grouped missions, data like u know that are possible in this project
- Nodes on hover should display small tooltips with some additional infos

### Explore view
- Main search engine, processed, perhaps linked data lands here
- This bookmark is strictly assigned with overview bookmark which helps selected data to be visualized, can allow to organize selected data
- Files are categorized by context (materials, incidents, fuels, etc.) and file type (csv, video)
- Choose files for further analysis
- Go to “visualization” with chosen files

### Visualization (detailed view from explore)
- Predefined templates for visualization(?) (histogram, linear diagram)
- User can view chosen data

### Overview
?