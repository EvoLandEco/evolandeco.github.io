// Get the size of the container dynamically
function getGraphContainerSize() {
    const container = document.getElementById('graph-container');
    return {
        width: container.clientWidth,
        height: container.clientHeight
    };
}

let { width, height } = getGraphContainerSize();

// Initialize node ID counter and data arrays.
let nodeId = 1;
let nodes = [{ id: nodeId, active: true, mutated: false, birthTime: 0, extinctTime: -1 }];
let links = [];
let activeNodes = [nodes[0]]; // Start with the root node as the only active node.
let simulationStep = 0;
let simulationTime = 0;
let maxSteps = parseInt(document.getElementById('maxSteps').value);
let simulationInterval = null; // To store the interval ID
let isRunning = false;

// Add global variables to store data
let lastLTable = null;
let lastNodeAccumulatedMutations = null;
let lastNewickChart = null;
let lastTraitChart = null;
let lastNodeTraits = null;
let lastTraitModel = null;
let lastTraitDimension = null;

// Declare global data variables for coarsened graph
let lastCoarsenedNodes = null;
let lastCoarsenedLinks = null;

// Event listener for the sliders controlling rates
const birthRateSlider = document.getElementById('birthRate');
const mutateRateSlider = document.getElementById('mutateRate');
const deathRateSlider = document.getElementById('deathRate');

const birthRateValue = document.getElementById('birthRateValue');
const mutateRateValue = document.getElementById('mutateRateValue');
const deathRateValue = document.getElementById('deathRateValue');

let birthRate = parseFloat(birthRateSlider.value);
let mutateRate = parseFloat(mutateRateSlider.value);
let deathRate = parseFloat(deathRateSlider.value);

let resizeTimeout;

// Select the graph container and append the SVG to it.
const svg = d3.select("#graph-container").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto;");

// Initialize the force simulation.
const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100).strength(1))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("collision", d3.forceCollide().radius(15))
    .force("center", d3.forceCenter())
    .force("x", d3.forceX())
    .force("y", d3.forceY());

// Initialize link and node elements.
let link = svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line");

// Group circle and text together
let node = svg.append("g")
    .attr("stroke-width", 1.5)
    .selectAll("g");

// Function to update the graph based on the current data.
function updateGraph() {
    // Update links.
    link = link.data(links, d => `${d.source.id}-${d.target.id}`);
    link.exit().remove();
    link = link.enter().append("line").merge(link);

    // Update nodes.
    node = node.data(nodes, d => d.id);
    node.exit().remove();

    // Enter new nodes as 'g' elements
    const nodeEnter = node.enter().append("g")
        .call(drag(simulation));

    nodeEnter.append("circle")
        .attr("r", 10);

    nodeEnter.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(d => d.id)
        .style("fill", "white")
        .style("font-size", "12px")
        // Bind hover events to the text element
        .on('mouseover', function (event, d) {
            // Trigger the same hover effect on the circle
            d3.select(this.parentNode).select('circle')
                .dispatch('mouseover');
        })
        .on('mouseout', function (event, d) {
            // Trigger the same unhover effect on the circle
            d3.select(this.parentNode).select('circle')
                .dispatch('mouseout');
        });

    // Append titles to the 'g' elements
    nodeEnter.append("title")
        .text(d => `Node ${d.id}${d.mutated ? " (mutated)" : ""}`);

    node = nodeEnter.merge(node);

    // Update the fill color based on the node's active and mutated status.
    node.select("circle")
        .attr("fill", d => d.active ? (d.mutated ? "red" : "#4264a6") : "gray")
        .attr("stroke", d => d.mutated ? "red" : "white")
        .on('mouseover', fullGraphMouseovered(true))
        .on('mouseout', fullGraphMouseovered(false));

    // Update and restart the simulation.
    simulation.nodes(nodes);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();
}

// Simulation tick function to update positions.
simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    // Update the position of the node groups
    node.attr("transform", d => `translate(${d.x},${d.y})`);
});

function fullGraphMouseovered(active) {
    return function (event, d) {
        highlightNewickTreeNode(d, active); // Highlight or unhighlight the corresponding Newick tree node
        highlightTraitTreeNode(d, active); // Highlight or unhighlight the corresponding trait-based phylogeny node
        highlightCoarsenedGraphNode(d.id, active); // Highlight or unhighlight the corresponding full graph node
        d3.select(this)
            .attr('stroke', active ? '#ff0' : d => d.mutated ? 'red' : 'white') // Highlight or reset stroke
            .attr('stroke-width', active ? 4 : 1.5) // Increase or reset stroke width
            .attr('r', active ? 12 : 10); // Increase or reset node size
    }
}


// Gillespie time-sampling simulation function.
function simulateStep() {
    if (activeNodes.length === 0) {
        console.log("No active nodes left. Stopping simulation.");
        pauseSimulation();
        return;
    }

    // Calculate total rate as sum of rates times the number of active nodes.
    const totalRate = (birthRate + mutateRate + deathRate) * activeNodes.length;

    // Sample time interval from exponential distribution.
    const timeInterval = sampleExponential(totalRate);
    console.log(`Time interval: ${timeInterval}`);

    // Update the simulation time by the sampled time interval.
    simulationTime += timeInterval;
    simulationStep += 1;
    console.log(`Simulation step: ${simulationStep}`);
    console.log(`Simulation time: ${simulationTime}`);

    const events = ['birth', 'birth+mutation', 'extinction'];
    const eventProbabilities = [birthRate, mutateRate, deathRate]; // Probabilities for each event
    const event = randomChoice(events, eventProbabilities);

    if (event === 'birth' || event === 'birth+mutation') {
        // Randomly sample an active node.
        const parent = randomChoice(activeNodes);
        nodeId += 1;
        const newNode = {
            id: nodeId,
            active: true,
            mutated: event === 'birth+mutation',
            birthTime: simulationTime,
            extinctTime: -1
        };
        nodes.push(newNode);
        activeNodes.push(newNode);
        links.push({ source: parent.id, target: newNode.id });
    } else if (event === 'extinction') {
        // Randomly sample an active node to become extinct.
        const nodeToExtinct = randomActiveNode();

        if (nodeToExtinct) {
            nodeToExtinct.active = false;
            nodeToExtinct.extinctTime = simulationTime;
            activeNodes = activeNodes.filter(n => n.id !== nodeToExtinct.id);
        }
    }

    // Update the graph with new data.
    updateGraph();

    // Build L table and get accumulated mutations
    mstep = parseInt(document.getElementById('mstep').value) || 0;
    let { lTable, nodeAccumulatedMutations, coarsenedNodes, coarsenedLinks } = buildLTable(mstep);
    lastLTable = lTable; // Store for later use
    lastNodeAccumulatedMutations = nodeAccumulatedMutations; // Store for later use
    lastCoarsenedNodes = coarsenedNodes;
    lastCoarsenedLinks = coarsenedLinks;
    lastNodeTraits = buildTraitTable(lastNodeAccumulatedMutations, lastTraitModel);

    console.log("L Table:");
    console.table(lastLTable);
    console.log("Node Accumulated Mutations:");
    console.table(lastNodeAccumulatedMutations);
    console.log("Node Traits:");
    console.table(lastNodeTraits);

    // Plot the trait data
    // plotTraits(lastNodeTraits, lastTraitDimension);

    // Plot current data as newick tree
    plotCurrentData();

    // Plot the trait-based phylogeny
    plotCurrentTraitData();

    // Plot the coarsened graph
    plotCoarsenedGraph();
}

// Function to sample time from an exponential distribution with rate λ.
function sampleExponential(rate) {
    return -Math.log(1 - Math.random()) / rate;
}

// Randomly selects an active node (to ensure extinction can happen on active nodes only).
function randomActiveNode() {
    if (activeNodes.length === 0) return null;
    return randomChoice(activeNodes);
}

// Utility function to select a random item with optional probabilities.
function randomChoice(items, probabilities) {
    if (!probabilities) {
        return items[Math.floor(Math.random() * items.length)];
    }
    const cumulative = [];
    let sum = 0;
    for (let p of probabilities) {
        sum += p;
        cumulative.push(sum);
    }
    const r = Math.random() * sum;
    for (let i = 0; i < cumulative.length; i++) {
        if (r < cumulative[i]) {
            return items[i];
        }
    }
}

// Drag behavior functions.
function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

// Start or resume the simulation.
function startResumeSimulation() {
    if (isRunning) return;

    maxSteps = parseInt(document.getElementById('maxSteps').value);
    lastTraitModel = document.getElementById('traitModel').value;
    lastTraitDimension = parseInt(document.getElementById('traitDimensions').value) || 2;

    // Dynamically compute the interval based on the sum of rates
    let sumRates = birthRate + mutateRate + deathRate;
    dynamicInterval = 1000 / sumRates;

    simulationInterval = d3.interval(() => {
        if (simulationStep >= maxSteps) {
            pauseSimulation();
            return;
        }
        simulateStep();
    }, dynamicInterval); // Interval for observable steps, not related to actual sampling time

    isRunning = true;
    toggleButtons();
    lockMaxStepsInput(true);
    lockTraitControls(true);
}

// Lock the max steps input field during simulation.
function lockMaxStepsInput(locked) {
    document.getElementById('maxSteps').disabled = locked;
}

function lockTraitControls(locked) {
    document.getElementById('traitModel').disabled = locked;
    document.getElementById('traitDimensions').disabled = locked;
}

function updateRates() {
    let sumRates = birthRate + mutateRate + deathRate;
    dynamicInterval = 1000 / sumRates; // Update dynamic interval
    restartSimulationInterval();
}

function restartSimulationInterval() {
    if (isRunning && simulationInterval) {
        // Stop the current interval
        simulationInterval.stop();

        // Start a new interval with the updated dynamicInterval
        simulationInterval = d3.interval(() => {
            if (simulationStep >= maxSteps) {
                pauseSimulation();
                return;
            }
            simulateStep();
        }, dynamicInterval);
    }
}

// Stop the simulation (pause).
function pauseSimulation() {
    if (simulationInterval) {
        simulationInterval.stop();
        isRunning = false;
        toggleButtons();
    }
}

// Reset the simulation to its initial state.
function resetSimulation() {
    pauseSimulation();
    // Initialize node ID counter and data arrays.
    nodeId = 1;
    nodes = [{ id: nodeId, active: true, mutated: false, birthTime: 0, extinctTime: -1 }];
    links = [];
    activeNodes = [nodes[0]]; // Start with the root node as the only active node.
    simulationTime = 0;
    simulationStep = 0;
    maxSteps = parseInt(document.getElementById('maxSteps').value);
    simulationInterval = null; // To store the interval ID
    isRunning = false;

    // Add global variables to store data
    lastLTable = null;
    lastNodeAccumulatedMutations = null;
    lastNewickChart = null;
    lastTraitChart = null;
    lastNodeTraits = null;
    lastTraitModel = null;
    lastTraitDimension = null;

    // Declare global data variables for coarsened graph
    lastCoarsenedNodes = null;
    lastCoarsenedLinks = null;

    birthRate = parseFloat(birthRateSlider.value);
    mutateRate = parseFloat(mutateRateSlider.value);
    deathRate = parseFloat(deathRateSlider.value);

    // Initialize data before step 1
    // Initialize data before step 1
    mstep = parseInt(document.getElementById('mstep').value) || 0;
    let { lTable, nodeAccumulatedMutations, coarsenedNodes, coarsenedLinks } = buildLTable(mstep);
    lastLTable = lTable; // Store for later use
    lastNodeAccumulatedMutations = nodeAccumulatedMutations; // Store for later use
    lastCoarsenedNodes = coarsenedNodes;
    lastCoarsenedLinks = coarsenedLinks;

    // Clear historical trait data
    previousNodeTraits = {};

    updateGraph();
    plotCurrentData();
    plotCurrentTraitData();
    plotCoarsenedGraph(lastCoarsenedNodes, lastCoarsenedLinks);
    toggleButtons(true);

    // Resurrect the trait controls
    lockTraitControls(false);
    lockMaxStepsInput(false);
}

// Toggle button states based on the simulation status.
function toggleButtons(isInitial = false) {
    document.getElementById('startButton').disabled = isRunning;
    document.getElementById('pauseButton').disabled = !isRunning;
}

// Initialize the graph.
updateGraph();

// Event listeners for the buttons.
document.getElementById('startButton').addEventListener('click', startResumeSimulation);
document.getElementById('pauseButton').addEventListener('click', pauseSimulation);
document.getElementById('resetButton').addEventListener('click', resetSimulation);

// Initialize the state to be ready for the first start.
toggleButtons(true);

function buildLTable(mstep) {
    // Initialize L table and coarsened graph data
    let lTable = [];
    let lTableIds = {}; // mapping from simulation node ids to L table ids
    let nodeAccumulatedMutations = {}; // mapping from node ids to accumulated mutations
    let coarsenedNodes = []; // Nodes in the coarsened graph
    let coarsenedLinks = []; // Links in the coarsened graph

    // Build child map for traversal
    let childMap = {};
    links.forEach(link => {
        let sourceId = link.source.id || link.source;
        let targetId = link.target.id || link.target;
        if (!childMap[sourceId]) {
            childMap[sourceId] = [];
        }
        childMap[sourceId].push(targetId);
    });

    // Assign initial L table id for node 1
    lTableIds[1] = 1; // initial node has L table id 1

    // First row of L table
    let initialNode = nodes.find(n => n.id === 1);
    lTable.push({
        eventTime: initialNode.birthTime,
        parentId: 0,
        childId: lTableIds[1],
        extinctTime: initialNode.extinctTime
    });

    // Add initial node to coarsened graph
    coarsenedNodes.push({ id: 1, active: initialNode.active, mutated: initialNode.mutated });

    // Initialize nodeAccumulatedMutations for the initial node
    nodeAccumulatedMutations[1] = 0;

    // Start traversal from node 1
    traverse(1, lTableIds[1], 0, lTableIds[1], 1, 0, 1);

    // Function to traverse the tree
    function traverse(nodeId, parentLTableId, mutationsEncountered, lastRecordedLTableId, accumulatedMutations, accumulatedMutationsInPath, parentInCoarsenedGraph) {
        let node = nodes.find(n => n.id === nodeId);

        // Always record accumulated mutations, regardless of mstep
        nodeAccumulatedMutations[nodeId] = accumulatedMutations;

        if (mstep === 0) {
            // Assign L table id
            lTableIds[nodeId] = nodeId;

            // Record entry in L table
            if (nodeId !== 1) { // Skip initial node since it's already added
                lTable.push({
                    eventTime: node.birthTime,
                    parentId: parentLTableId,
                    childId: lTableIds[nodeId],
                    extinctTime: node.extinctTime
                });
            }

            // Add this node to coarsened graph
            if (nodeId !== 1) {
                coarsenedNodes.push({ id: nodeId, active: node.active, mutated: node.mutated });
                coarsenedLinks.push({ source: parentInCoarsenedGraph, target: nodeId });
                parentInCoarsenedGraph = nodeId; // Update for children
            }

            // Traverse the children
            if (childMap[nodeId]) {
                childMap[nodeId].forEach(childId => {
                    traverse(childId, lTableIds[nodeId], mutationsEncountered, lTableIds[nodeId], accumulatedMutations + 1, accumulatedMutationsInPath, parentInCoarsenedGraph);
                });
            }
        } else {
            // mstep > 0
            let newMutationsEncountered = mutationsEncountered;
            if (node.mutated) {
                newMutationsEncountered += 1;
            }

            let shouldRecord = false;

            if (node.mutated && newMutationsEncountered === mstep) {
                shouldRecord = true;
                newMutationsEncountered = 0; // Reset counter after recording
            }

            if (shouldRecord) {
                // Assign L table id
                lTableIds[nodeId] = nodeId;

                // Record entry in L table
                lTable.push({
                    eventTime: node.birthTime,
                    parentId: lastRecordedLTableId,
                    childId: lTableIds[nodeId],
                    extinctTime: node.extinctTime
                });

                // Add this node to coarsened graph
                coarsenedNodes.push({ id: nodeId, active: node.active, mutated: node.mutated });
                coarsenedLinks.push({ source: parentInCoarsenedGraph, target: nodeId });
                parentInCoarsenedGraph = nodeId;

                lastRecordedLTableId = lTableIds[nodeId];
                accumulatedMutationsInPath = 0; // Reset after recording
            } else {
                accumulatedMutationsInPath += node.mutated ? 1 : 0;
            }

            // Traverse the children
            if (childMap[nodeId]) {
                childMap[nodeId].forEach(childId => {
                    traverse(childId, parentLTableId, newMutationsEncountered, lastRecordedLTableId, accumulatedMutations + 1, accumulatedMutationsInPath, parentInCoarsenedGraph);
                });
            }
        }
    }

    // Sort the L table based on the childId (third column)
    lTable.sort((a, b) => a.childId - b.childId);

    // Return the L table, the accumulated mutations, and the coarsened graph
    return { lTable, nodeAccumulatedMutations, coarsenedNodes, coarsenedLinks };
}

// Store a global trait table to keep track of previous node traits across calls
let previousNodeTraits = {};

function buildTraitTable(nodeAccumulatedMutations, model) {
    let traitDimension = lastTraitDimension || 2;

    // Ensure traitDimension stays between 1 and 10
    traitDimension = Math.min(Math.max(traitDimension, 1), 10);

    // Variance for Brownian motion step size (slight deviation from 1)
    const variance = 0;

    // Start with the previous trait values
    let nodeTraits = Object.assign({}, previousNodeTraits);

    // For each node, perform the trait change model
    for (let nodeId in nodeAccumulatedMutations) {
        // If the node has not already been processed, process it
        if (!nodeTraits.hasOwnProperty(nodeId)) {
            // Find the direct parent node
            let parentNodeId = findParentNodeId(nodeId);

            // Inherit traits from the parent node
            let parentTraits = parentNodeId && nodeTraits[parentNodeId] ? nodeTraits[parentNodeId].slice() : Array(traitDimension).fill(0);

            // If the node is mutated, apply a random mutation on the inherited traits
            let node = nodes.find(n => n.id === parseInt(nodeId));
            if (node && node.mutated) {
                if (model === 'brownian') {
                    // Apply one random mutation on a single dimension
                    let dim = Math.floor(Math.random() * traitDimension);

                    // Randomly decide to increment or decrement, with a small variance on top of 1
                    let delta = (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() * variance * 2 - variance));

                    // Update the parent's trait coordinates
                    parentTraits[dim] += delta;
                }
                // If needed, other mutation models can be implemented here
            }

            // Store the result in nodeTraits
            nodeTraits[nodeId] = parentTraits;
        }
    }

    // Update global `previousNodeTraits`, keeping results for future calls
    previousNodeTraits = nodeTraits;

    return nodeTraits;
}

// Helper function to find the parent node ID of a given node
function findParentNodeId(nodeId) {
    for (let link of links) {
        if (link.target.id === parseInt(nodeId) || link.target === parseInt(nodeId)) {
            return link.source.id || link.source;
        }
    }
    return null; // No parent found (should not happen for non-root nodes)
}

function filterTraitTable(nodeTraits, lTable, pruneExtinct) {
    // Create a set of child IDs from the L table (the recorded nodes)
    let recordedNodeIds = new Set();

    // Loop over the L table rows
    lTable.forEach(row => {
        // If pruning extinct nodes, only include nodes with extinctTime == -1
        if (pruneExtinct) {
            if (row.extinctTime === -1) {
                recordedNodeIds.add(row.childId);
            }
        } else {
            recordedNodeIds.add(row.childId);
        }
    });

    // Filter the trait table to include only nodes that are in the recordedNodeIds set
    let filteredTraits = {};
    for (let nodeId in nodeTraits) {
        if (recordedNodeIds.has(parseInt(nodeId))) {
            filteredTraits[nodeId] = nodeTraits[nodeId];
        }
    }

    return filteredTraits;
}


// Function to display the L table using DataTables
function displayLTable(lTable) {
    let container = document.getElementById('lTableContainer');
    container.innerHTML = ''; // Clear previous content

    // Create a table element with the required structure
    let table = document.createElement('table');
    table.id = 'lTable';
    table.className = 'display'; // DataTables requires the 'display' class

    let thead = document.createElement('thead');
    let headerRow = document.createElement('tr');

    ['Event Time', 'Parent ID', 'Child ID', 'Extinct Time'].forEach(text => {
        let th = document.createElement('th');
        th.innerText = text;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    let tbody = document.createElement('tbody');
    lTable.forEach(entry => {
        let row = document.createElement('tr');
        let cellEventTime = document.createElement('td');
        cellEventTime.innerText = entry.eventTime;
        let cellParentId = document.createElement('td');
        cellParentId.innerText = entry.parentId;
        let cellChildId = document.createElement('td');
        cellChildId.innerText = entry.childId;
        let cellExtinctTime = document.createElement('td');
        cellExtinctTime.innerText = entry.extinctTime;

        row.appendChild(cellEventTime);
        row.appendChild(cellParentId);
        row.appendChild(cellChildId);
        row.appendChild(cellExtinctTime);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Apply DataTables to the table
    $(document).ready(function () {
        $('#lTable').DataTable({
            paging: true,
            searching: true,
            ordering: true,
            info: true
        });
    });
}


function LTableToNewick(LTable, age, pruneExtinct) {
    // Make a deep copy of the LTable to avoid modifying the original
    let L2 = JSON.parse(JSON.stringify(LTable));

    // Order L2 based on the absolute value of Child ID
    L2.sort((a, b) => Math.abs(a.childId) - Math.abs(b.childId));

    // Set the Event Time of the first row to -1
    L2[0].eventTime = -1;

    // Compute tend for each row
    L2.forEach(row => {
        row.tend = (row.extinctTime === -1) ? age : row.extinctTime;
    });

    // Remove extinctTime from L2
    L2.forEach(row => {
        delete row.extinctTime;
    });

    // Build linlist
    let linlist = L2.map(row => {
        return {
            eventTime: row.eventTime,
            parentId: row.parentId,
            childId: row.childId,
            label: Math.abs(row.childId).toString(), // Remove "t" prefix
            tend: row.tend
        };
    });

    let done = false;
    while (!done) {
        // Find index j of the row with maximum eventTime
        let j = linlist.reduce((maxIndex, row, index, arr) => {
            return row.eventTime > arr[maxIndex].eventTime ? index : maxIndex;
        }, 0);

        let parent = linlist[j].parentId;
        // Find index where childId equals parent
        let parentj = linlist.findIndex(row => row.childId === parent);

        if (parentj !== -1) {
            // Build spec1 and spec2
            let spec1 = linlist[parentj].label + ':' + (linlist[parentj].tend - linlist[j].eventTime);
            let spec2 = linlist[j].label + ':' + (linlist[j].tend - linlist[j].eventTime);
            // Update parent row
            linlist[parentj].label = '(' + spec1 + ',' + spec2 + ')';
            linlist[parentj].tend = linlist[j].eventTime;
            // Remove row j
            linlist.splice(j, 1);
        } else {
            // Update linlist[j] with the row from L2 where childId equals parent
            let parentRow = L2.find(row => row.childId === parent);
            if (parentRow) {
                linlist[j].eventTime = parentRow.eventTime;
                linlist[j].parentId = parentRow.parentId;
                linlist[j].childId = parentRow.childId;
            } else {
                // If parent not found, break the loop
                done = true;
            }
        }

        if (linlist.length === 1) {
            done = true;
        }
    }

    // Append root length and semicolon
    let newickString = linlist[0].label + ':' + linlist[0].tend + ';';

    if (pruneExtinct) {
        // Parse the Newick string
        let treeData = parseNewick(newickString);

        // Collect labels of extinct species
        let extinctLabels = LTable.filter(row => row.extinctTime !== -1)
            .map(row => Math.abs(row.childId).toString()); // No "t" prefix

        // Remove extinct tips from the tree
        treeData = pruneTree(treeData, extinctLabels);

        // Serialize back to Newick string
        newickString = serializeNewick(treeData) + ';';
    }

    return newickString;
}

function pruneTree(node, labelsToRemove) {
    if (!node) return null;

    // If node is a tip
    if (!node.branchset || node.branchset.length === 0) {
        // If node.name is in labelsToRemove, return null to prune
        if (labelsToRemove.includes(node.name)) {
            return null;
        } else {
            return node;
        }
    }

    // If node has branches
    let newBranches = [];
    for (let child of node.branchset) {
        let prunedChild = pruneTree(child, labelsToRemove);
        if (prunedChild) {
            newBranches.push(prunedChild);
        }
    }

    // If after pruning, no branches remain, return null to prune this node
    if (newBranches.length === 0) {
        return null;
    }

    // Otherwise, set the new branchset
    node.branchset = newBranches;
    return node;
}

function serializeNewick(node) {
    if (!node) return '';

    let result = '';

    if (node.branchset && node.branchset.length > 0) {
        let childrenStr = node.branchset.map(child => serializeNewick(child)).join(',');
        result += '(' + childrenStr + ')';
    }

    if (node.name) {
        result += node.name;
    }

    if (node.length !== undefined) {
        result += ':' + node.length;
    }

    return result;
}

function parseNewick(a) {
    for (var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0; t < s.length; t++) {
        var n = s[t];
        switch (n) {
            case "(":
                var c = {};
                r.branchset = [c];
                e.push(r);
                r = c;
                break;
            case ",":
                var c = {};
                e[e.length - 1].branchset.push(c);
                r = c;
                break;
            case ")":
                r = e.pop();
                break;
            case ":":
                break;
            default:
                var h = s[t - 1];
                ")" == h || "(" == h || "," == h ? r.name = n : ":" == h && (r.length = parseFloat(n));
        }
    }
    return r;
}

function newwickvisShowLength() {
    const checkbox = document.getElementById('newickvis-showLengthCheckbox');
    return checkbox.checked;
}

function newickvisDrawRadialTree(d3, data, cluster, setRadius, innerRadius, maxLength, outerRadius, width, linkExtensionConstant, linkConstant, linkExtensionVariable, linkVariable) {
    const root = d3.hierarchy(data, d => d.branchset)
        .sum(d => d.branchset ? 0 : 1)
        .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));

    cluster(root);
    setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

    const svg = d3.create("svg")
        .attr("id", "newickvis-chart")
        .attr("viewBox", [-outerRadius, -outerRadius, outerRadius * 2, outerRadius * 2])
        .attr("width", width)
        .attr("font-family", "sans-serif")
        .attr("font-size", 40);

    svg.append("style").text(`
        .link--active {
            stroke: #000 !important;
            stroke-width: 1.5px;
            filter: drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5));
        }
        .link-extension--active {
            stroke-opacity: .6;
            stroke-width: 1.5px;
            stroke-dasharray: 3,2;
        }
        .label--active {
            font-weight: bold;
        }`
    );

    const linkExtension = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0.25)
        .selectAll("path")
        .data(root.links().filter(d => !d.target.children))
        .join("path")
        .each(function (d) { d.target.linkExtensionNode = this; })
        .attr("d", linkExtensionConstant);

    const link = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .selectAll("path")
        .data(root.links())
        .join("path")
        .each(function (d) { d.target.linkNode = this; })
        .attr("d", linkConstant)
        .attr("stroke", d => d.target.color);

    const node = svg.append("g")
        .selectAll("circle")
        .data(root.descendants())
        .join("circle")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
        .attr("r", d => d === root ? 14 : d.children ? 0 : 18)
        .attr("fill", d => d === root ? "#f7d724" : d.children ? "#007bff" : "#757ca3")
        .attr("stroke-width", 1.5)
        .on("mouseover", newickvisMouseovered(true))
        .on("mouseout", newickvisMouseovered(false));

    svg.append("g")
        .selectAll("text")
        .data(root.leaves())
        .join("text")
        .attr("dy", ".31em")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${innerRadius + 30},0)${d.x < 180 ? "" : " rotate(180)"}`)
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .text(d => d.data.name.replace(/_/g, " "))
        .on("mouseover", newickvisMouseovered(true))
        .on("mouseout", newickvisMouseovered(false));

    function newickvisUpdate(checked) {
        const t = d3.transition().duration(750);
        linkExtension.transition(t).attr("d", checked ? linkExtensionVariable : linkExtensionConstant);
        link.transition(t).attr("d", checked ? linkVariable : linkConstant);
    }

    function newickvisMouseovered(active) {
        return function (event, d) {
            highlightFullGraphNode(d.data.name, active); // Highlight corresponding node in the graph
            highlightCoarsenedGraphNode(d.data.name, active); // Highlight corresponding node in the coarsened graph
            highlightTraitTreeNode(d.data.name, active); // Highlight corresponding node in the trait-based phylogeny
            d3.select(this).classed("label--active", active);
            d3.select(d.linkExtensionNode).classed("link-extension--active", active).raise();
            do d3.select(d.linkNode).classed("link--active", active).raise();
            while (d = d.parent);
        };
    }

    return Object.assign(svg.node(), { newickvisUpdate });
}

function traitvisDrawRadialTree(d3, data, cluster, setRadius, innerRadius, maxLength, outerRadius, width, linkExtensionConstant, linkConstant, linkExtensionVariable, linkVariable) {
    const root = d3.hierarchy(data, d => d.branchset)
        .sum(d => d.branchset ? 0 : 1)
        .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));

    cluster(root);
    setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

    const svg = d3.create("svg")
        .attr("id", "traitvis-chart")
        .attr("viewBox", [-outerRadius, -outerRadius, outerRadius * 2, outerRadius * 2]) // Fit chart within the container
        .attr("width", width) // Ensure SVG scales to fit the full container width
        .attr("font-family", "sans-serif")
        .attr("font-size", 40);

    svg.append("style").text(`
        .link--active {
            stroke: #000 !important;
            stroke-width: 1.5px;
            filter: drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5));
        }
        .link-extension--active {
            stroke-opacity: .6;
            stroke-width: 1.5px;
            stroke-dasharray: 3,2;
        }
        .label--active {
            font-weight: bold;
        }`
    );

    const linkExtension = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0.25)
        .selectAll("path")
        .data(root.links().filter(d => !d.target.children))
        .join("path")
        .each(function (d) { d.target.linkExtensionNode = this; })
        .attr("d", linkExtensionConstant);

    const link = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .selectAll("path")
        .data(root.links())
        .join("path")
        .each(function (d) { d.target.linkNode = this; })
        .attr("d", linkConstant)
        .attr("stroke", d => d.target.color);

    const node = svg.append("g")
        .selectAll("circle")
        .data(root.descendants())
        .join("circle")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
        .attr("r", d => d === root ? 14 : d.children ? 0 : 18)
        .attr("fill", d => d === root ? "#f7d724" : d.children ? "#007bff" : "#757ca3")
        .attr("stroke-width", 1.5)
        .on("mouseover", traitvisMouseovered(true))
        .on("mouseout", traitvisMouseovered(false));

    svg.append("g")
        .selectAll("text")
        .data(root.leaves())
        .join("text")
        .attr("dy", ".31em")
        .attr("transform", d => `rotate(${d.x - 90}) translate(${innerRadius + 30},0)${d.x < 180 ? "" : " rotate(180)"}`)
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .text(d => d.data.name.replace(/_/g, " "))
        .on("mouseover", traitvisMouseovered(true))
        .on("mouseout", traitvisMouseovered(false));

    function traitvisUpdate(checked) {
        const t = d3.transition().duration(750);
        linkExtension.transition(t).attr("d", checked ? linkExtensionVariable : linkExtensionConstant);
        link.transition(t).attr("d", checked ? linkVariable : linkConstant);
    }

    function traitvisMouseovered(active) {
        return function (event, d) {
            highlightFullGraphNode(d.data.name, active); // Highlight corresponding node in the graph
            highlightCoarsenedGraphNode(d.data.name, active); // Highlight corresponding node in the coarsened graph
            highlightNewickTreeNode(d.data.name, active); // Highlight corresponding node in the trait-based phylogeny
            d3.select(this).classed("label--active", active);
            d3.select(d.linkExtensionNode).classed("link-extension--active", active).raise();
            do d3.select(d.linkNode).classed("link--active", active).raise();
            while (d = d.parent);
        };
    }

    return Object.assign(svg.node(), { traitvisUpdate });
}

function plotCurrentData() {
    let age = simulationTime;

    // Get the value of pruneExtinct checkbox
    let pruneExtinct = document.getElementById('pruneExtinct').checked;

    // Get the value of showBranchLengths checkbox
    let showBranchLengths = document.getElementById('showBranchLengths').checked;

    // Get the updated mstep value
    let mstep = parseInt(document.getElementById('mstep').value) || 0;

    // Rebuild the L table and accumulated mutations based on the new mstep
    let { lTable, nodeAccumulatedMutations } = buildLTable(mstep);
    lastLTable = lTable; // Update the lastLTable

    let newickString = LTableToNewick(lastLTable, age, pruneExtinct);

    // Parse Newick string back into a dataset
    let newickData = parseNewick(newickString);

    // Display the L table
    // displayLTable(lTable);

    // Plot the data, passing the showBranchLengths parameter
    plotNewickData(newickData, showBranchLengths);
}


function plotNewickData(data, showBranchLengths) {
    let plotContainer = document.getElementById('plot-container');

    // Function to get plot container size
    function getPlotContainerSize() {
        return {
            width: plotContainer.clientWidth,
            height: plotContainer.clientHeight
        };
    }

    let { width, height } = getPlotContainerSize();

    // Remove any previous chart
    let existingChart = plotContainer.querySelector('#newickvis-chart');
    if (existingChart) {
        plotContainer.removeChild(existingChart);
    }

    const outerRadius = width * 1.4;
    const innerRadius = outerRadius - 170;
    const cluster = d3.cluster()
        .size([360, innerRadius])
        .separation((a, b) => 1);

    const maxLength = function maxLength(d) {
        return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
    };

    const setRadius = function setRadius(d, y0, k) {
        d.radius = (y0 += d.data.length) * k;
        if (d.children) d.children.forEach(d => setRadius(d, y0, k));
    };

    // Link helper functions
    const linkStep = function linkStep(startAngle, startRadius, endAngle, endRadius) {
        const c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI);
        const s0 = Math.sin(startAngle);
        const c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI);
        const s1 = Math.sin(endAngle);
        return "M" + startRadius * c0 + "," + startRadius * s0
            + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
            + "L" + endRadius * c1 + "," + endRadius * s1;
    };

    const linkConstant = function linkConstant(d) {
        return linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
    };

    const linkExtensionConstant = function linkExtensionConstant(d) {
        return linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
    };

    const linkVariable = function linkVariable(d) {
        return linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
    };

    const linkExtensionVariable = function linkExtensionVariable(d) {
        return linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);
    };

    // Remove any previous chart
    d3.select("#newickvis-chart").selectAll("*").remove();

    try {
        // Try to create the Newick tree chart
        lastNewickChart = newickvisDrawRadialTree(d3, data, cluster, setRadius, innerRadius, maxLength, outerRadius, width, linkExtensionConstant, linkConstant, linkExtensionVariable, linkVariable);

        // Clear any previous content in the plot container
        plotContainer.innerHTML = '';

        // Append the Newick chart to the plot container
        plotContainer.appendChild(lastNewickChart);

        // Try to update the Newick chart if branch lengths are to be shown
        lastNewickChart.newickvisUpdate(showBranchLengths);

    } catch (error) {
        // If an error occurs, log it (optional)
        console.log("Cannot reconstruct the Newick tree from the data.");

        // Display a message instead of the chart
        plotContainer.innerHTML = '<p class="error-text">No Valid Phylogenetic Tree</p>';
    }
}

// Function to get the size of the container dynamically
function getCoarsenedGraphContainerSize() {
    const container = document.getElementById('coarsened-graph-container');
    return {
        width: container.clientWidth,
        height: container.clientHeight
    };
}

// Function to plot the coarsened graph
function plotCoarsenedGraph() {
    let plotContainer = document.getElementById('coarsened-graph-container');
    plotContainer.innerHTML = ''; // Clear previous content

    let { width, height } = getCoarsenedGraphContainerSize();

    const svg = d3.select('#coarsened-graph-container').append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height])
        .attr('style', 'max-width: 100%; height: auto;');

    const coarsenedSimulation = d3.forceSimulation(lastCoarsenedNodes)
        .force('link', d3.forceLink(lastCoarsenedLinks).id(d => d.id).distance(100).strength(1))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('collision', d3.forceCollide().radius(15))
        .force('center', d3.forceCenter())
        .force('x', d3.forceX())
        .force('y', d3.forceY());

    let link = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(lastCoarsenedLinks)
        .enter().append('line')
        .on('mouseover', function (event, d) {
            d3.select(this).attr('stroke', '#ff0').attr('stroke-width', 3); // Highlight the link
        })
        .on('mouseout', function (event, d) {
            d3.select(this).attr('stroke', '#999').attr('stroke-width', 1); // Reset link style
        });

    let node = svg.append('g')
        .attr('stroke-width', 1.5)
        .selectAll('g')
        .data(lastCoarsenedNodes)
        .enter().append('g')
        .call(drag(coarsenedSimulation));

    node.append('circle')
        .attr('r', 10)
        .attr('fill', d => d.active ? (d.mutated ? 'red' : '#4264a6') : 'gray')
        .attr('stroke', d => d.mutated ? 'red' : 'white')
        .on('mouseover', graphMouseovered(true))
        .on('mouseout', graphMouseovered(false));

    node.append('text')
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
        .text(d => d.id)
        .style('fill', 'white')
        .style('font-size', '12px')
        // Bind hover events to the text element
        .on('mouseover', function (event, d) {
            // Trigger the same hover effect on the circle
            d3.select(this.parentNode).select('circle')
                .dispatch('mouseover');
        })
        .on('mouseout', function (event, d) {
            // Trigger the same unhover effect on the circle
            d3.select(this.parentNode).select('circle')
                .dispatch('mouseout');
        });

    coarsenedSimulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function graphMouseovered(active) {
        return function (event, d) {
            highlightNewickTreeNode(d, active); // Highlight or unhighlight the corresponding Newick tree node
            highlightTraitTreeNode(d, active); // Highlight or unhighlight the corresponding trait-based phylogeny node
            highlightFullGraphNode(d.id, active); // Highlight or unhighlight the corresponding full graph node
            d3.select(this)
                .attr('stroke', active ? '#ff0' : d => d.mutated ? 'red' : 'white') // Highlight or reset stroke
                .attr('stroke-width', active ? 4 : 1.5) // Increase or reset stroke width
                .attr('r', active ? 12 : 10); // Increase or reset node size
        }
    }

    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }
}

function highlightNewickTreeNode(originData, highlight) {
    // Check if originData has a id property or is a id number itself
    if (!originData.hasOwnProperty('id')) {
        originData = { id: originData };
    }

    let newickChartNode = d3.selectAll('#newickvis-chart text')
        .filter(d => d.data.name === originData.id.toString())
        .data()[0]; // Get the data for the node in the Newick tree

    // Check if the node exists in the Newick tree
    if (!newickChartNode) {
        return;
    }

    // Traverse from the focal node to the root in the Newick tree
    do {
        // Highlight the corresponding label in the Newick tree
        d3.selectAll('#newickvis-chart text')
            .filter(d => d === newickChartNode) // Match the node in the Newick tree
            .classed("label--active", highlight); // Highlight or unhighlight the label

        // Highlight the link between the node and its parent in the Newick tree
        d3.selectAll('#newickvis-chart path')
            .filter(d => d.target === newickChartNode) // Match the child node
            .classed("link--active", highlight)
            .raise(); // Highlight or unhighlight the link

        // Move to the parent node in the Newick tree
        newickChartNode = newickChartNode.parent;

    } while (newickChartNode); // Continue until the root is reached (i.e., when parent is null)
}

function highlightTraitTreeNode(originData, highlight) {
    // Check if originData has a id property or is a id number itself
    if (!originData.hasOwnProperty('id')) {
        originData = { id: originData };
    }

    let traitChartNode = d3.selectAll('#traitvis-chart text')
        .filter(d => d.data.name === originData.id.toString())
        .data()[0]; // Get the data for the node in the trait-based phylogeny

    // Check if the node exists in the trait-based phylogeny
    if (!traitChartNode) {
        return;
    }

    // Traverse from the focal node to the root in the trait-based phylogeny
    do {
        // Highlight the corresponding label in the trait-based phylogeny
        d3.selectAll('#traitvis-chart text')
            .filter(d => d === traitChartNode) // Match the node in the trait-based phylogeny
            .classed("label--active", highlight); // Highlight or unhighlight the label

        // Highlight the link between the node and its parent in the trait-based phylogeny
        d3.selectAll('#traitvis-chart path')
            .filter(d => d.target === traitChartNode) // Match the child node
            .classed("link--active", highlight)
            .raise(); // Highlight or unhighlight the link

        // Move to the parent node in the trait-based phylogeny
        traitChartNode = traitChartNode.parent;

    } while (traitChartNode); // Continue until the root is reached (i.e., when parent is null)
}


// Highlight the corresponding coarsened graph node
function highlightCoarsenedGraphNode(nodeId, highlight) {
    d3.selectAll('#coarsened-graph-container circle')
        .filter(d => d.id === parseInt(nodeId)) // Match the id
        .attr('stroke', highlight ? '#ff0' : d => d.mutated ? 'red' : 'white') // Highlight or reset stroke
        .attr('stroke-width', highlight ? 4 : 1.5) // Increase or reset stroke width
        .attr('r', highlight ? 12 : 10); // Increase or reset node size
}

// Highlight the corresponding full graph node
function highlightFullGraphNode(nodeId, highlight) {
    d3.selectAll('#graph-container circle')
        .filter(d => d.id === parseInt(nodeId)) // Match the id
        .attr('stroke', highlight ? '#ff0' : d => d.mutated ? 'red' : 'white') // Highlight or reset stroke
        .attr('stroke-width', highlight ? 4 : 1.5) // Increase or reset stroke width
        .attr('r', highlight ? 12 : 10); // Increase or reset node size
}

function plotCurrentTraitData() {
    // Get the value of showBranchLengths checkbox
    let showBranchLengths = document.getElementById('showBranchLengths').checked;
    let pruneExtinct = document.getElementById('pruneExtinct').checked;

    // Convert node traits to trait-based phylogeny
    let filteredNodeTraits = filterTraitTable(lastNodeTraits, lastLTable, pruneExtinct);

    let traitPhyloString = hclustToNewick(filteredNodeTraits);
    // Parse Newick string back into a dataset
    let traitData = parseNewick(traitPhyloString);

    // Plot the data, passing the showBranchLengths parameter
    plotTraitData(traitData, showBranchLengths);
}

function plotTraitData(data, showBranchLengths) {
    let plotContainer = document.getElementById('trait-container');

    // Function to get plot container size
    function getPlotContainerSize() {
        return {
            width: plotContainer.clientWidth,
            height: plotContainer.clientHeight
        };
    }

    let { width, height } = getPlotContainerSize();

    // Remove any previous chart
    let existingChart = plotContainer.querySelector('#traitvis-chart');
    if (existingChart) {
        plotContainer.removeChild(existingChart);
    }

    const outerRadius = width * 1.4;
    const innerRadius = outerRadius - 170;
    const cluster = d3.cluster()
        .size([360, innerRadius])
        .separation((a, b) => 1);

    const maxLength = function maxLength(d) {
        return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
    };

    const setRadius = function setRadius(d, y0, k) {
        d.radius = (y0 += d.data.length) * k;
        if (d.children) d.children.forEach(d => setRadius(d, y0, k));
    };

    // Link helper functions
    const linkStep = function linkStep(startAngle, startRadius, endAngle, endRadius) {
        const c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI);
        const s0 = Math.sin(startAngle);
        const c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI);
        const s1 = Math.sin(endAngle);
        return "M" + startRadius * c0 + "," + startRadius * s0
            + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
            + "L" + endRadius * c1 + "," + endRadius * s1;
    };

    const linkConstant = function linkConstant(d) {
        return linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
    };

    const linkExtensionConstant = function linkExtensionConstant(d) {
        return linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
    };

    const linkVariable = function linkVariable(d) {
        return linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
    };

    const linkExtensionVariable = function linkExtensionVariable(d) {
        return linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);
    };

    // Remove any previous chart
    d3.select("#traitvis-chart").selectAll("*").remove();

    try {
        // Try to create the chart
        lastTraitChart = traitvisDrawRadialTree(d3, data, cluster, setRadius, innerRadius, maxLength, outerRadius, width, linkExtensionConstant, linkConstant, linkExtensionVariable, linkVariable);

        // Clear any previous content
        plotContainer.innerHTML = '';

        // Append the chart to the container
        plotContainer.appendChild(lastTraitChart);

        lastTraitChart.traitvisUpdate(showBranchLengths);
    } catch (error) {
        // If an error occurs, log the error (optional)
        console.log("Cannot reconstruct the trait-based phylogeny from the data.");

        // Display a message instead of the chart
        plotContainer.innerHTML = '<p class="error-text">No Valid Trait Tree</p>';
    }
}

// Function to calculate the distance matrix
function calculateDistanceMatrix(nodeTraits) {
    const nodeIds = Object.keys(nodeTraits); // Use actual node IDs as keys
    const distanceMatrix = [];

    for (let i = 0; i < nodeIds.length; i++) {
        const row = [];
        for (let j = 0; j < nodeIds.length; j++) {
            if (i === j) {
                row.push(0); // Distance between a node and itself is 0
            } else {
                const distance = euclideanDistance(nodeTraits[nodeIds[i]], nodeTraits[nodeIds[j]]);
                row.push(distance);
            }
        }
        distanceMatrix.push(row);
    }

    return { distanceMatrix, nodeIds }; // Return actual node IDs
}

// Function to calculate Euclidean distance between two nodes' traits
function euclideanDistance(traits1, traits2) {
    let sum = 0;
    for (let i = 0; i < traits1.length; i++) {
        sum += Math.pow(traits1[i] - traits2[i], 2);
    }
    return Math.sqrt(sum);
}

// Function to calculate the average distance between two clusters
function averageDistance(cluster1, cluster2, distanceMatrix, nodeIds) {
    let totalDist = 0;
    let count = 0;

    for (let i = 0; i < cluster1.nodes.length; i++) {
        for (let j = 0; j < cluster2.nodes.length; j++) {
            const node1 = nodeIds.indexOf(cluster1.nodes[i]);
            const node2 = nodeIds.indexOf(cluster2.nodes[j]);
            const dist = distanceMatrix[node1][node2]; // Ensure node1 and node2 map correctly
            totalDist += dist;
            count++;
        }
    }

    return totalDist / count;
}

// Perform hierarchical clustering using UPGMA
function performHClust(nodeTraits) {
    const { distanceMatrix, nodeIds } = calculateDistanceMatrix(nodeTraits);

    // Initialize clusters with actual node IDs
    let clusters = nodeIds.map((id, index) => ({
        nodes: [id],  // Store original node ID here
        distance: 0,
        left: null,
        right: null
    }));

    while (clusters.length > 1) {
        let minDist = Infinity;
        let minPair = [-1, -1];

        // Find the closest pair of clusters
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const dist = averageDistance(clusters[i], clusters[j], distanceMatrix, nodeIds);
                if (dist < minDist) {
                    minDist = dist;
                    minPair = [i, j];
                }
            }
        }

        // Merge the closest pair
        const [i, j] = minPair;
        const newCluster = {
            nodes: [...clusters[i].nodes, ...clusters[j].nodes], // Combine node IDs
            distance: minDist / 2,
            left: clusters[i],
            right: clusters[j]
        };

        // Remove the old clusters and add the new one
        clusters = clusters.filter((_, index) => index !== i && index !== j);
        clusters.push(newCluster);
    }

    // Return the root of the cluster tree
    return clusters[0];
}

// Convert the hierarchical cluster tree to Newick format
function convertClusterToNewick(cluster) {
    // Check if there is nodes array
    if (!cluster.nodes) {
        return '';
    }
    if (cluster.nodes.length === 1) {
        // It's a leaf node, return the actual node ID
        return `${cluster.nodes[0]}:${cluster.distance.toFixed(2)}`;
    } else {
        // It's an internal node
        const left = convertClusterToNewick(cluster.left);
        const right = convertClusterToNewick(cluster.right);
        return `(${left},${right}):${cluster.distance.toFixed(2)}`;
    }
}

// Convert hierarchical clustering results to Newick format
function hclustToNewick(nodeTraits) {
    // Check if nodeTraits is empty
    if (Object.keys(nodeTraits).length === 0) {
        return ';';
    } else {
        const cluster = performHClust(nodeTraits);
        return convertClusterToNewick(cluster) + ';';
    }
}

// Function to plot traits based on their dimensions
function plotTraits(nodeTraits, traitDimension) {
    let plotContainer = document.getElementById('trait-container');
    // Function to get plot container size
    function getPlotContainerSize() {
        return {
            width: plotContainer.clientWidth,
            height: plotContainer.clientHeight
        };
    }

    let { width, height } = getPlotContainerSize();

    const margin = { top: 20, right: 20, bottom: 50, left: 40 };
    const colors = d3.scaleOrdinal(d3.schemeCategory10); // Unique colors for nodes

    // Clear the trait container for a fresh plot
    const container = d3.select("#trait-container");
    container.selectAll("*").remove();
    // Create the SVG canvas
    const svg = container.append("svg")
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Set up scales
    const xScale = d3.scaleLinear()
        .domain([-10, 10]) // Customize the domain based on expected trait values
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([-10, 10]) // Customize the domain based on expected trait values
        .range([height, 0]);

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Create circles for nodes with unique colors and transition
    const nodes = Object.keys(nodeTraits).map(nodeId => ({
        id: nodeId,
        traits: nodeTraits[nodeId]
    }));

    if (traitDimension === 1) {
        // Plot on the X-axis
        svg.selectAll("circle")
            .data(nodes, d => d.id)
            .join("circle")
            .attr("cx", d => xScale(d.traits[0]))
            .attr("cy", yScale(0)) // All nodes are on the Y=0 line
            .attr("r", 5)
            .attr("fill", d => colors(d.id))
            .transition() // Apply animation
            .duration(1000)
            .attr("cx", d => xScale(d.traits[0]));

    } else if (traitDimension === 2) {
        // Plot on a 2D plane
        svg.selectAll("circle")
            .data(nodes, d => d.id)
            .join("circle")
            .attr("cx", d => xScale(d.traits[0]))
            .attr("cy", d => yScale(d.traits[1]))
            .attr("r", 5)
            .attr("fill", d => colors(d.id))
            .transition() // Apply animation
            .duration(1000)
            .attr("cx", d => xScale(d.traits[0]))
            .attr("cy", d => yScale(d.traits[1]));

    } else {
        // For trait dimensions > 2, apply dimension reduction (e.g., PCA)
        // Perform basic PCA (Principal Component Analysis)
        const pcaData = performPCA(nodes.map(d => d.traits), 2);

        // Plot the reduced PCA values
        svg.selectAll("circle")
            .data(nodes.map((node, i) => ({
                id: node.id,
                traits: pcaData[i]
            })))
            .join("circle")
            .attr("cx", d => xScale(d.traits[0]))
            .attr("cy", d => yScale(d.traits[1]))
            .attr("r", 5)
            .attr("fill", d => colors(d.id))
            .transition() // Apply animation
            .duration(1000)
            .attr("cx", d => xScale(d.traits[0]))
            .attr("cy", d => yScale(d.traits[1]));
    }
}

function performPCA(data, numComponents = 2) {
    const matrix = numeric.transpose(data);
    const svdResult = numeric.svd(matrix);
    const U = svdResult.U;
    const S = svdResult.S;
    const V = svdResult.V;

    // Select the top components (principal components)
    const topComponents = V.slice(0, numComponents).map(row => row.slice(0, numComponents));

    // Project data onto the top principal components
    const reducedData = numeric.dot(data, numeric.transpose(topComponents));

    return reducedData;
}

// Event listener for the Prune Extinct Lineages checkbox
document.getElementById('pruneExtinct').addEventListener('change', () => {
    // Re-plot the data without advancing simulation step
    if (lastLTable && lastNodeAccumulatedMutations) {
        plotCurrentData();
        plotCurrentTraitData();
    }
});

// Event listener for the Show Branch Lengths checkbox
document.getElementById('showBranchLengths').addEventListener('change', () => {
    // Re-plot the data without advancing simulation step
    if (lastLTable && lastNodeAccumulatedMutations && lastNewickChart && lastTraitChart) {
        // Get the current state of the checkbox
        let showBranchLengths = document.getElementById('showBranchLengths').checked;
        lastNewickChart.newickvisUpdate(showBranchLengths);
        lastTraitChart.traitvisUpdate(showBranchLengths);
    }
});

// Event listener for the mstep input field
document.getElementById('mstep').addEventListener('input', () => {
    // Re-plot the data when mstep changes
    if (lastLTable && lastNodeAccumulatedMutations) {
        plotCurrentData();
        plotCurrentTraitData();
    }
});

// Event listener for the coarsen level input field
document.getElementById('mstep').addEventListener('change', () => {
    // Re-plot the data when coarsen level changes
    let mstep = parseInt(document.getElementById('mstep').value) || 0;
    if (lastCoarsenedNodes && lastCoarsenedLinks) {
        let { lTable, nodeAccumulatedMutations, coarsenedNodes, coarsenedLinks } = buildLTable(mstep);
        lastCoarsenedNodes = coarsenedNodes;
        lastCoarsenedLinks = coarsenedLinks;
        plotCoarsenedGraph(lastCoarsenedNodes, lastCoarsenedLinks);
    }
});

birthRateSlider.addEventListener('input', function () {
    birthRateValue.textContent = parseFloat(birthRateSlider.value).toFixed(2);
    birthRate = parseFloat(birthRateSlider.value);
    updateRates();
});

mutateRateSlider.addEventListener('input', function () {
    mutateRateValue.textContent = parseFloat(mutateRateSlider.value).toFixed(2);
    mutateRate = parseFloat(mutateRateSlider.value);
    updateRates();
});

deathRateSlider.addEventListener('input', function () {
    deathRateValue.textContent = parseFloat(deathRateSlider.value).toFixed(2);
    deathRate = parseFloat(deathRateSlider.value);
    updateRates()
});

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        plotCurrentData(); // Re-render plot after resizing ends
        plotCurrentTraitData(); // Re-render trait plot after resizing ends
        updateGraph(); // Update graph after resizing ends
        plotCoarsenedGraph(lastCoarsenedNodes, lastCoarsenedLinks); // Re-render coarsened graph after resizing ends
    }, 10);
});

// Plot the initial data on page load
// Initialize data before step 1
mstep = parseInt(document.getElementById('mstep').value) || 0;
let { lTable, nodeAccumulatedMutations, coarsenedNodes, coarsenedLinks } = buildLTable(mstep);
lastNodeAccumulatedMutations = nodeAccumulatedMutations;
lastCoarsenedNodes = coarsenedNodes;
lastCoarsenedLinks = coarsenedLinks;

plotCurrentData();
plotCurrentTraitData();
plotCoarsenedGraph(lastCoarsenedNodes, lastCoarsenedLinks);