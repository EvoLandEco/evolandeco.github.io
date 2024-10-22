// Declare variables
let gridRadius;
let obstacleProbability;
let methodHexZero;

let globalBetaN;
let globalBetaPhi;
let globalGammaN;
let globalGammaPhi;
let globalDeltaN;
let globalDeltaPhi;

let intrinsicBirthRate;
let intrinsicMutationRate;
let intrinsicDeathRate;
let intrinsicMigrationRate;

let simulationTime;
let currentTime = 0;

const hexDimension = 24; // Hexagon size remains constant

// Variables to control simulation state
let simulationRunning = false;
let simulationPaused = false;
let speciesIndexArray = []; // Moved to global scope for reset functionality

// Variables for grid and SVG elements
let grid;
let svg;
let tooltip;

// Set up the SVG canvas dimensions
let svgWidth = 0;
let svgHeight = 0;
const gapScale = 0;

// Variables for classes and functions
let Hex;
let Species;
let createChildSpecies;
let setSpeciesExtinct;
let updateRates;
let countNonExtinctSpecies;
let getRandomBorderHex;
let getCenterHex;
let getRandomHex;
let selectHexZero;
let simulateNextEvent;
let executeEvent;
let getHexNeighbors;
let getColor;
let updateVisualization;
let updateTooltipContent;

// Function to enable or disable settings inputs
function toggleSettings(disabled) {
  const inputs = document.querySelectorAll('#controlPanel input, #controlPanel select');
  inputs.forEach(input => {
    input.disabled = disabled;
  });
}

// Function to initialize the simulation parameters from HTML inputs
function initializeSimulation() {
  // Get values from HTML elements
  gridRadius = parseInt(document.getElementById('gridRadius').value);
  obstacleProbability = parseFloat(document.getElementById('obstacleProbability').value);
  methodHexZero = document.getElementById('methodHexZero').value;

  globalBetaN = parseFloat(document.getElementById('globalBetaN').value);
  globalBetaPhi = parseFloat(document.getElementById('globalBetaPhi').value);
  globalGammaN = parseFloat(document.getElementById('globalGammaN').value);
  globalGammaPhi = parseFloat(document.getElementById('globalGammaPhi').value);
  globalDeltaN = parseFloat(document.getElementById('globalDeltaN').value);
  globalDeltaPhi = parseFloat(document.getElementById('globalDeltaPhi').value);

  intrinsicBirthRate = parseFloat(document.getElementById('intrinsicBirthRate').value);
  intrinsicMutationRate = parseFloat(document.getElementById('intrinsicMutationRate').value);
  intrinsicDeathRate = parseFloat(document.getElementById('intrinsicDeathRate').value);
  intrinsicMigrationRate = parseFloat(document.getElementById('intrinsicMigrationRate').value);

  simulationTime = parseInt(document.getElementById('simulationTime').value);
  currentTime = 0;

  // Clear previous species index array
  speciesIndexArray = [];

  // Initialize the SVG canvas
  svg = d3.select('#svgCanvas')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

  // Initialize the tooltip
  tooltip = d3.select('#tooltip');
}

// Function to initialize and display the grid
function initializeGrid() {
  // Clear previous SVG content
  svg.selectAll('*').remove();

  // Define the base Hex class
  const BaseHex = Honeycomb.defineHex({
    dimensions: hexDimension
  });

  // Define the custom Hex class by extending the base class
  Hex = class extends BaseHex {
    constructor(...args) {
      super(...args); // Call the base class constructor
      // Initialize custom properties
      this.speciesData = null;
      this.environmentData = null;
      this.cubeCoordinates = null;
      this.isObstacle = false;
    }

    // Add methods to get and set the data
    getSpeciesData() {
      return this.speciesData;
    }
    setSpeciesData(data) {
      this.speciesData = data;
    }
    getEnvironmentData() {
      return this.environmentData;
    }
    setEnvironmentData(data) {
      this.environmentData = data;
    }
    addSpecies(species) {
      if (!this.speciesData) {
        this.speciesData = [];
      }
      this.speciesData.push(species);
      species.setHex(this);
    }
    removeSpecies(species) {
      if (this.speciesData) {
        this.speciesData = this.speciesData.filter(s => s !== species);
      }
    }
    migrateSpecies(species, targetHex) {
      this.removeSpecies(species);
      targetHex.addSpecies(species);
      species.setHex(targetHex);
    }
  };

  // Define the species class with unique index and intrinsic species properties
  Species = class {
    constructor(index, parent = null, hex, timeBirth = 0, timeDeath = -1) {
      this.index = index;
      this.parent = parent;
      this.hex = hex;
      this.birthRate = intrinsicBirthRate;
      this.mutationRate = intrinsicMutationRate;
      this.deathRate = intrinsicDeathRate;
      this.migrationRate = intrinsicMigrationRate;
      this.active = true;
      this.timeBirth = timeBirth;
      this.timeDeath = timeDeath;
    }

    // Getters and setters of the rates and status (extinct or not)
    getIndex() {
      return this.index;
    }
    getParentIndex() {
      return this.parent;
    }
    getHex() {
      return this.hex;
    }
    setHex(hex) {
      this.hex = hex;
    }
    getTimeBirth() {
      return this.timeBirth;
    }
    getTimeDeath() {
      return this.timeDeath;
    }
    getBirthRate() {
      return this.birthRate;
    }
    setBirthRate(rate) {
      this.birthRate = rate;
    }
    getMutationRate() {
      return this.mutationRate;
    }
    setMutationRate(rate) {
      this.mutationRate = rate;
    }
    getDeathRate() {
      return this.deathRate;
    }
    setDeathRate(rate) {
      this.deathRate = rate;
    }
    getMigrationRate() {
      return this.migrationRate;
    }
    setMigrationRate(rate) {
      this.migrationRate = rate;
    }
    isActive() {
      return this.active;
    }
    setExtinct(time) {
      this.active = false;
      this.timeDeath = time;
    }
    setMigrate(hex) {
      this.hex = hex;
    }
  };

  // Set up the grid dimensions
  grid = new Honeycomb.Grid(Hex, Honeycomb.spiral({ start: [0, 0], radius: gridRadius }));

  // Initialize the hexagons
  grid.forEach(hex => {
    // Calculate cube coordinates for the hex
    hex.cubeCoordinates = { q: hex.q, r: hex.r, s: hex.s };

    hex.environmentData = {
      betaN: globalBetaN,
      betaPhi: globalBetaPhi,
      gammaN: globalGammaN,
      gammaPhi: globalGammaPhi,
      deltaN: globalDeltaN,
      deltaPhi: globalDeltaPhi
    };

    // Initially, no hexagons are obstacles
    hex.isObstacle = false;
  });

  // Select initial hexagon
  let hexZero = selectHexZero(methodHexZero);

  // If the selected hexZero is an obstacle (unlikely here), select another one
  while (hexZero.isObstacle) {
    console.warn("Selected hexZero is an obstacle. Selecting another one.");
    hexZero = selectHexZero(methodHexZero);
  }

  // Add obstacles to the grid
  grid.forEach(hex => {
    // Randomly set hexagons as obstacles, except for hexZero
    if (hex !== hexZero && Math.random() < obstacleProbability) {
      hex.isObstacle = true;
    }
  });

  // Place the initial common ancestor in the selected hex-zero
  if (hexZero) {
    const initialSpecies = new Species(0, null, hexZero);
    hexZero.addSpecies(initialSpecies);
    speciesIndexArray.push(initialSpecies);
  }

  // Update rates for each hexagon in the grid
  grid.forEach(hex => {
    updateRates(hex);
  });

  // Display the grid
  updateVisualization();
}

// Function to start or resume the simulation
function startSimulation() {
  if (simulationRunning && !simulationPaused) return; // Prevent multiple simulations from running

  if (simulationPaused) {
    // Resume simulation
    simulationPaused = false;
    runSimulation();
    // Update buttons
    document.getElementById('pauseButton').disabled = false;
    document.getElementById('startButton').disabled = true;
    return;
  }

  // Else, start new simulation
  toggleSettings(true); // Disable settings inputs
  simulationRunning = true;
  simulationPaused = false;

  // Start the simulation loop
  runSimulation();
}

// Function to compute the number of non-extinct species within a hexagon
countNonExtinctSpecies = function (hex) {
  if (!hex.speciesData) {
    return 0;
  }
  return hex.speciesData.filter(species => species.isActive()).length;
};

// Function to update the rates of species within a hexagon according to the number of species
updateRates = function (hex) {
  const nonExtinctCount = countNonExtinctSpecies(hex);
  if (hex.speciesData) {
    hex.speciesData.forEach(species => {
      species.setBirthRate(intrinsicBirthRate + globalBetaN * nonExtinctCount);
      species.setDeathRate(intrinsicDeathRate + globalGammaN * nonExtinctCount);
      species.setMigrationRate(intrinsicMigrationRate + globalDeltaN * nonExtinctCount);
    });
  }
};

// Function to create a child species from a non-extinct (active) species
createChildSpecies = function (parentSpecies) {
  if (parentSpecies.isActive()) {
    const newIndex = speciesIndexArray.length;
    const childSpecies = new Species(newIndex, parentSpecies.index, parentSpecies.getHex());
    speciesIndexArray.push(childSpecies);
    parentSpecies.getHex().addSpecies(childSpecies);
    return childSpecies;
  }
  return null;
};

// Function to set a species to extinct
setSpeciesExtinct = function (species, time) {
  species.setExtinct(time);
};

// Define methods to select a hex-zero to place the common ancestor
getRandomBorderHex = function (grid) {
  // Given current hexagonal layout, a border hexagon lies on the outer ring
  // Thus we construct the coordinates manually:
  const borderHexes = [];
  for (let q = 0; q <= gridRadius; q++) {
    borderHexes.push([q, -gridRadius]);
  }
  for (let q = -gridRadius; q <= 0; q++) {
    borderHexes.push([q, gridRadius]);
  }
  for (let q = 0; q <= gridRadius; q++) {
    borderHexes.push([q, (gridRadius - q)]);
  }
  for (let r = -gridRadius; r <= 0; r++) {
    borderHexes.push([gridRadius, r]);
  }
  for (let r = 0; r <= gridRadius; r++) {
    borderHexes.push([-gridRadius, r]);
  }
  for (let r = -gridRadius; r <= 0; r++) {
    borderHexes.push([r, (-gridRadius - r)]);
  }

  sampledCoord = borderHexes[Math.floor(Math.random() * borderHexes.length)]

  return grid.getHex(sampledCoord);
};

getCenterHex = function (grid) {
  return grid.getHex([0, 0]);
};

// Method to completely randomly select a hexagon from the grid
getRandomHex = function (grid) {
  // Traverse the grid in a spiral pattern and record the coordinates of each hexagon
  const hexCoordinates = [];
  grid.forEach(hex => {
    hexCoordinates.push([hex.q, hex.r]);
  });

  // Randomly select a hexagon from the grid
  return grid.getHex(hexCoordinates[Math.floor(Math.random() * hexCoordinates.length)]);
};

// Hex-zero selector with above defined methods
selectHexZero = function (method) {
  switch (method) {
    case 'center':
      return getCenterHex(grid);
    case 'random':
      return getRandomHex(grid);
    case 'border':
      return getRandomBorderHex(grid);
    default:
      return getCenterHex(grid);
  }
};

// Function to simulate events based on Gillespie's algorithm
simulateNextEvent = function () {
  // Create a list of all events with their rates
  const events = [];

  grid.forEach(hex => {
    if (hex.speciesData) {
      hex.speciesData.forEach(species => {
        if (species.isActive()) {
          // Birth event
          events.push({
            type: 'birth',
            species,
            hex,
            rate: species.getBirthRate()
          });
          // Death event
          events.push({
            type: 'death',
            species,
            hex,
            rate: species.getDeathRate()
          });
          // Migration event
          events.push({
            type: 'migration',
            species,
            hex,
            rate: species.getMigrationRate()
          });
        }
      });
    }
  });

  // Calculate total rate
  const totalRate = events.reduce((sum, event) => sum + event.rate, 0);
  if (totalRate === 0) {
    return null; // No more events to process
  }

  // Sample time interval for the next event
  const timeInterval = -Math.log(Math.random()) / totalRate;
  currentTime += timeInterval;
  if (currentTime > simulationTime) {
    currentTime = simulationTime;
    return null;
  }

  // Select which event happens
  let cumulativeRate = 0;
  const randomValue = Math.random() * totalRate;
  for (const event of events) {
    cumulativeRate += event.rate;
    if (randomValue <= cumulativeRate) {
      return event;
    }
  }
  return null;
};

// Function to get the neighbors of a hexagon
getHexNeighbors = function (hex, grid) {
  let neighbors = [];
  const { q, r } = hex.cubeCoordinates;
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.E));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.N));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.NE));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.NW));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.S));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.SE));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.SW));
  neighbors.push(grid.neighborOf([q, r], Honeycomb.Direction.W));

  return neighbors.filter(neighbor => neighbor !== undefined && neighbor !== null);
};

// Function to execute the selected event
executeEvent = function (event) {
  const { type, species, hex } = event;
  switch (type) {
    case 'birth':
      createChildSpecies(species);
      updateRates(hex);
      break;
    case 'death':
      setSpeciesExtinct(species, currentTime);
      updateRates(hex);
      break;
    case 'migration':
      const neighbors = getHexNeighbors(hex, grid).filter(neighbor => !neighbor.isObstacle);
      if (neighbors.length > 0) {
        const targetHex = neighbors[Math.floor(Math.random() * neighbors.length)];
        hex.migrateSpecies(species, targetHex);
        updateRates(hex);
        updateRates(targetHex);
      }
      break;
  }
};

// Function to get color based on non-extinct species count
getColor = function (hex, scaleType = 'YlGnBu') {
  // If the hexagon is an obstacle, return specific color
  if (hex.isObstacle) {
    return '#c2a3a3'; // Color for obstacles
  }

  const count = countNonExtinctSpecies(hex);

  // If count is 0, return light grey
  if (count === 0) {
    return '#f4f4f1'; // Light grey color
  }

  // Define the color scale based on scaleType
  let colorScale;
  switch (scaleType) {
    case 'blues':
      colorScale = d3.scaleSequential(d3.interpolateBlues);
      break;
    case 'reds':
      colorScale = d3.scaleSequential(d3.interpolateReds);
      break;
    case 'cool':
      colorScale = d3.scaleSequential(d3.interpolateCool); // Blue to Red gradient
      break;
    case 'RdBu':
      colorScale = d3.scaleSequential(d3.interpolateRdBu); // Red to Blue diverging
      break;
    case 'plasma':
      colorScale = d3.scaleSequential(d3.interpolatePlasma); // Purple to yellow
      break;
    case 'custom-blue-red':
      colorScale = d3.scaleLinear().range(["blue", "red"]); // Custom Blue to Red
      break;
    case 'YlGnBu':
      colorScale = d3.scaleSequential(d3.interpolateYlGnBu); // Yellow to Green to Blue
      break;
    default:
      colorScale = d3.scaleSequential(d3.interpolateViridis); // Default Viridis scale
  }

  // Apply the color scale for non-zero values
  return colorScale.domain([0, 20])(count);
};

let currentHoveredHex = null;
let tooltipUpdateInterval = null;

// Function to update the visualization based on the grid data
updateVisualization = function () {
  // Bind data
  const hexagons = svg.selectAll('.hexagon')
      .data(grid, hex => `${hex.q},${hex.r}`);

  // Enter selection (only executed once for new hexagons)
  const newHexagons = hexagons.enter()
      .append('polygon')
      .attr('class', 'hexagon')
      .attr('points', hex => {
        const point = Honeycomb.hexToPoint(hex);
        const x = point.x * gapScale + svgWidth / 2;
        const y = point.y * gapScale + svgHeight / 2;
        const corners = hex.corners.map(corner => [
          corner.x + x,
          corner.y + y
        ]);
        return corners.map(point => point.join(',')).join(' ');
      })
      .attr('fill', hex => getColor(hex))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5)
      .style('opacity', 0) // Set initial opacity to 0 for enter transition
      .on('mouseover', function (event, hex) {
        // Show tooltip
        currentHoveredHex = hex;
        tooltip.style('opacity', 1);

        // Highlight hexagon by increasing stroke-width and changing stroke color
        d3.select(this)
            .attr('stroke', '#ff5f5f')  // Change stroke color to red
            .attr('stroke-width', 2)    // Increase stroke width
            .raise();                   // Bring hexagon to front

        // Start interval to update tooltip content
        tooltipUpdateInterval = setInterval(() => {
          updateTooltipContent(event, currentHoveredHex);
        }, 100); // Update every 100ms
      })
      .on('mousemove', function (event, hex) {
        // Update current hex and tooltip position
        currentHoveredHex = hex;
        updateTooltipContent(event, hex);
      })
      .on('mouseout', function () {
        // Hide tooltip
        tooltip.style('opacity', 0);
        currentHoveredHex = null;

        // Reset hexagon appearance (remove highlighting)
        d3.select(this)
            .attr('stroke', '#000')     // Reset stroke color to black
            .attr('stroke-width', 0.5); // Reset stroke width

        // Clear the interval
        clearInterval(tooltipUpdateInterval);
        tooltipUpdateInterval = null;
      });

  // Apply enter transition (fade in and scale in)
  newHexagons.transition()
      .duration(500)           // Transition duration of 500ms
      .style('opacity', 1)     // Fade in
      .attr('transform', 'scale(1)'); // Scale in effect (no scale initially)

  // Update selection (update existing hexagons) with transition for fill color
  hexagons.transition()  // Apply transition for color update
      .duration(100)     // Duration of 500ms
      .attr('fill', hex => getColor(hex));  // Smooth transition of fill color

  // Exit selection (hexagons being removed)
  hexagons.exit()
      .transition()      // Apply exit transition
      .duration(500)     // Transition duration of 500ms
      .style('opacity', 0)   // Fade out
      .attr('transform', 'scale(0)')  // Scale down to 0
      .remove();           // Remove the hexagon after the transition completes
};

// Function to update the tooltip content
updateTooltipContent = function (event, hex) {
  // Update tooltip content and position
  const nonExtinctCount = countNonExtinctSpecies(hex);
  const speciesIndices = hex.speciesData ? hex.speciesData.filter(s => s.isActive()).map(s => s.index) : [];
  const environmentData = hex.environmentData;

  // Get all non-extinct species
  let speciesInfo = '';
  const activeSpecies = hex.speciesData ? hex.speciesData.filter(s => s.isActive()) : [];
  if (activeSpecies.length > 0) {
    speciesInfo = activeSpecies.map(species => `
                <strong>Species Index:</strong> ${species.index}<br/>
                <strong>Birth Rate:</strong> ${species.getBirthRate().toFixed(3)}<br/>
                <strong>Death Rate:</strong> ${species.getDeathRate().toFixed(3)}<br/>
                <strong>Migration Rate:</strong> ${species.getMigrationRate().toFixed(3)}<br/>
            `).join('<br/>');
  } else {
    speciesInfo = `<em>No active species in this hex.</em><br/>`;
  }

  // Environment data formatting
  const environmentInfo = `
            <strong>Environment Data:</strong><br/>
            BetaN: ${environmentData.betaN}<br/>
            BetaPhi: ${environmentData.betaPhi}<br/>
            GammaN: ${environmentData.gammaN}<br/>
            GammaPhi: ${environmentData.gammaPhi}<br/>
            DeltaN: ${environmentData.deltaN}<br/>
            DeltaPhi: ${environmentData.deltaPhi}<br/>
        `;

  // Check if the hex is an obstacle
  let obstacleInfo = '';
  if (hex.isObstacle) {
    obstacleInfo = `<strong>Status:</strong> <span style="color:red;">Obstacle</span><br/>`;
  } else {
    obstacleInfo = `<strong>Status:</strong> <span style="color:#00cf00;">Accessible</span><br/>`;
  }

  const tooltipHtml = `
            <strong>Hex Coordinates:</strong> (${hex.q}, ${hex.r})<br/>
            ${obstacleInfo}
            <strong>Non-extinct Species Count:</strong> ${nonExtinctCount}<br/>
            ${speciesInfo}
            ${environmentInfo}
        `;

  tooltip.html(tooltipHtml)
      .style('left', (event.pageX + 10) + 'px') // Position tooltip to the right of the cursor
      .style('top', (event.pageY + 10) + 'px'); // Position tooltip below the cursor
};

// Asynchronous simulation loop
async function runSimulation() {
  // Disable start button after simulation starts or resumes
  document.getElementById('startButton').disabled = true;
  // Enable pause button
  document.getElementById('pauseButton').disabled = false;

  while (currentTime < simulationTime && !simulationPaused) {
    const event = simulateNextEvent();
    if (!event) {
      console.log('No more events to process.');
      simulationRunning = false;
      break;
    }

    executeEvent(event);

    // Update visualization
    updateVisualization();

    // Wait for 200ms
    await sleep(200);

    if (simulationPaused) {
      break;
    }
    
    if (!simulationRunning) {
      return;
    }
  }

  if (currentTime >= simulationTime) {
    console.log('Simulation completed.');
    simulationRunning = false;
    // Re-enable settings inputs and start button after simulation completes
    toggleSettings(false);
    document.getElementById('startButton').disabled = false;
    // Disable pause button
    document.getElementById('pauseButton').disabled = true;
  }
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to pause the simulation
function pauseSimulation() {
  if (!simulationRunning || simulationPaused) return;

  // Pause simulation
  simulationPaused = true;

  // Disable pause button
  document.getElementById('pauseButton').disabled = true;

  // Enable start button
  document.getElementById('startButton').disabled = false;
}

// Function to reset the simulation
function resetSimulation() {
  // Pause the simulation
  simulationPaused = false;
  simulationRunning = false;

  // Re-enable settings inputs
  toggleSettings(false);

  // Reset buttons
  document.getElementById('startButton').disabled = false;
  document.getElementById('pauseButton').disabled = true;

  // Reinitialize simulation parameters and grid
  initializeSimulation();
  initializeGrid();
}

// Event listeners for Start, Pause, and Reset buttons
document.getElementById('startButton').addEventListener('click', startSimulation);
document.getElementById('pauseButton').addEventListener('click', pauseSimulation);
document.getElementById('resetButton').addEventListener('click', resetSimulation);

// Function to get svgCanvas smaller dimension
function getSvgCanvasMinDimension() {
  const svgCanvas = document.getElementById('svgCanvas');
  const rect = svgCanvas.getBoundingClientRect();  // Use getBoundingClientRect to get the actual dimensions
  // Return the smaller dimension
  return Math.min(rect.width, rect.height);
}

// Function to set svgWidth and svgHeight to the smaller dimension
function setSvgCanvasMinDimension() {
  const minDimension = getSvgCanvasMinDimension();
  svgWidth = minDimension;
  svgHeight = minDimension;

  console.log(`SVG Width: ${svgWidth}, SVG Height: ${svgHeight}`);
}

// On page load, initialize simulation parameters and grid
window.onload = function () {
  // Set svgWidth and svgHeight to the smaller dimension
  setSvgCanvasMinDimension();
  initializeSimulation();
  initializeGrid();
};

// On control panel change, update the simulation parameters
document.getElementById('controlPanel').addEventListener('change', function () {
  if (!simulationRunning) {
    // Set svgWidth and svgHeight to the smaller dimension
    setSvgCanvasMinDimension();
    initializeSimulation();
    initializeGrid();
  }
});