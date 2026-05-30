import { MRFModel } from './mrf_model.js';

// ---- State ----
const model = new MRFModel();
let wasmLoaded = false;
let currentView = 'form'; // 'form' or 'graph'

const visualState = {
    nodePositions: new Map(), // Map<varName, {x, y}>
    selectedNode: null,       // varName or null
    selectedEdge: null,       // "var1,var2" or null
    isDragging: false,
    dragTarget: null,
    dragOffset: { x: 0, y: 0 }
};

// ---- DOM Elements ----
const els = {
    // Variables
    varName: document.getElementById('var-name'),
    varLevels: document.getElementById('var-levels'),
    btnAddVar: document.getElementById('btn-add-var'),
    varList: document.getElementById('var-list'),
    errorVar: document.getElementById('error-var'),

    // Factors
    factorType: document.getElementById('factor-type'),
    unaryForm: document.getElementById('unary-form'),
    binaryForm: document.getElementById('binary-form'),
    unaryVar: document.getElementById('unary-var'),
    unaryEntries: document.getElementById('unary-entries'),
    btnAddUnary: document.getElementById('btn-add-unary'),
    binaryVar1: document.getElementById('binary-var1'),
    binaryVar2: document.getElementById('binary-var2'),
    binaryEntries: document.getElementById('binary-entries'),
    btnAddBinary: document.getElementById('btn-add-binary'),
    factorList: document.getElementById('factor-list'),
    errorFactor: document.getElementById('error-factor'),

    // Evidence
    evidenceVar: document.getElementById('evidence-var'),
    evidenceLevel: document.getElementById('evidence-level'),
    btnSetEvidence: document.getElementById('btn-set-evidence'),
    evidenceList: document.getElementById('evidence-list'),
    errorEvidence: document.getElementById('error-evidence'),

    // Controls
    iterations: document.getElementById('iterations'),
    btnInfer: document.getElementById('btn-infer'),
    btnReset: document.getElementById('btn-reset'),
    loading: document.getElementById('loading'),

    // Results
    resultsContainer: document.getElementById('results-container'),

    // View Tabs
    tabForm: document.getElementById('tab-form'),
    tabGraph: document.getElementById('tab-graph'),
    formView: document.getElementById('form-view'),
    graphView: document.getElementById('graph-view'),
    
    // Graph Elements
    canvas: document.getElementById('mrf-canvas'),
    edgesLayer: document.getElementById('edges-layer'),
    nodesLayer: document.getElementById('nodes-layer'),
    graphSidebar: document.getElementById('graph-sidebar'),
    sidebarContent: document.getElementById('sidebar-content'),
    btnAddNode: document.getElementById('btn-add-node'),
    btnLinkMode: document.getElementById('btn-link-mode'),
    btnDeleteSelected: document.getElementById('btn-delete-selected'),
    btnGraphInfer: document.getElementById('btn-graph-infer'),
    btnGraphReset: document.getElementById('btn-graph-reset'),
    graphLoading: document.getElementById('graph-loading'),
};

// ---- Initialization ----

async function init() {
    // Set up UI immediately
    updateAllDropdowns();
    renderVariables();
    renderFactors();
    renderEvidence();
    setupEventListeners();

    // Pre-load WASM module
    try {
        const { default: createMRFModule } = await import('./mrf.js');
        await createMRFModule();
        wasmLoaded = true;
        els.loading.classList.add('hidden');
    } catch (err) {
        console.error('Failed to preload WASM:', err);
        els.loading.textContent = 'WASM pre-load failed.';
    }

    // Debug: confirm tabs are wired
    console.log('✅ App initialized. Tab form:', !!els.tabForm, 'Tab graph:', !!els.tabGraph);
}

// ---- View Switching ----

function switchView(viewName) {
    if (currentView === viewName) return;
    
    console.log(`🔄 Switching view to: ${viewName}`);
    currentView = viewName;
    
    // Update tabs
    els.tabForm.classList.toggle('active', viewName === 'form');
    els.tabGraph.classList.toggle('active', viewName === 'graph');
    
    // Update containers
    els.formView.classList.toggle('hidden', viewName === 'graph');
    els.graphView.classList.toggle('hidden', viewName === 'form');
    
    // Sync state
    if (viewName === 'graph') {
        console.log("🎨 Initializing Graph View...");
        renderGraphFromModel();
    } else {
        console.log("📝 Switching to Form View...");
        renderVariables();
        renderFactors();
        renderEvidence();
    }
}

// ---- Event Listeners ----

function setupEventListeners() {
    // Variables
    els.btnAddVar.addEventListener('click', handleAddVariable);
    
    // Factors
    els.factorType.addEventListener('change', toggleFactorForm);
    els.btnAddUnary.addEventListener('click', handleAddUnaryFactor);
    els.btnAddBinary.addEventListener('click', handleAddBinaryFactor);
    
    // Evidence
    els.btnSetEvidence.addEventListener('click', handleSetEvidence);
    
    // Controls
    els.btnInfer.addEventListener('click', handleInference);
    els.btnReset.addEventListener('click', handleReset);

    // View Tabs
    els.tabForm.addEventListener('click', () => switchView('form'));
    els.tabGraph.addEventListener('click', () => switchView('graph'));
    
    // Event Delegation for Sidebar
    els.sidebarContent.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.classList.contains('btn') && target.dataset.action) {
            const action = target.dataset.action;
            const varName = target.dataset.var;
            const var1 = target.dataset.var1;
            const var2 = target.dataset.var2;
            
            let needsRender = false;
            
            if (action === 'set-evidence') {
                const select = target.closest('.evidence-section').querySelector('select');
                if (select && select.value) {
                    model.setEvidence(varName, select.value);
                    needsRender = true;
                }
            } else if (action === 'clear-evidence') {
                model.clearEvidence(varName);
                needsRender = true;
            } else if (action === 'save-unary') {
                if (doSaveUnaryWeights(varName)) {
                    needsRender = true;
                }
            } else if (action === 'save-binary') {
                if (doSaveBinaryWeights(var1, var2)) {
                    needsRender = true;
                }
            }
            
            if (needsRender) {
                renderGraphFromModel();
                renderEvidence();
            }
        }
    });
}

function renderGraphFromModel() {
    console.log("🔄 Rendering Graph...");
    
    // Safety check: Ensure canvas exists
    if (!els.canvas || !els.nodesLayer || !els.edgesLayer) {
        console.error("❌ Canvas elements not found. Check HTML structure.");
        return;
    }

    // Clear canvas
    els.edgesLayer.innerHTML = '';
    els.nodesLayer.innerHTML = '';

    const vars = Array.from(model.variables.keys());
    console.log(`📊 Variables in model: ${vars.length}`, vars);

    if (vars.length === 0) {
        const text = createSVGElement('text', {
            x: '50%', y: '50%', 'text-anchor': 'middle', fill: '#7f8c8d', 'font-size': '16px'
        }, "Add nodes to start building your graph");
        els.nodesLayer.appendChild(text);
        updateSidebar(null);
        console.log("✅ Graph rendered (empty)");
        return;
    }

    // 1. Ensure positions exist for all nodes
    vars.forEach(name => {
        if (!visualState.nodePositions.has(name)) {
            // Auto-position: grid layout
            const count = visualState.nodePositions.size;
            const cols = Math.ceil(Math.sqrt(vars.length));
            const x = 100 + (count % cols) * 150;
            const y = 100 + Math.floor(count / cols) * 120;
            visualState.nodePositions.set(name, { x, y });
            console.log(`📍 Auto-positioned ${name} at (${x}, ${y})`);
        }
    });

    // 2. Render Nodes
    vars.forEach(name => {
        const pos = visualState.nodePositions.get(name);
        const info = model.variables.get(name);
        const isEvidence = model.evidence.has(name);
        const isSelected = visualState.selectedNode === name;

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
        group.setAttribute("data-var", name);
        group.setAttribute("class", "node-group");

        // Calculate size
        const textWidth = Math.max(60, name.length * 10 + 20);
        const textHeight = 40;
        const width = textWidth;
        const height = textHeight;

        // Background Rect
        const rect = createSVGElement('rect', {
            x: -width/2, y: -height/2, width: width, height: height,
            class: `node-rect ${isSelected ? 'selected' : ''} ${isEvidence ? 'evidence' : ''}`
        });

        // Text
        const text = createSVGElement('text', {
            x: 0, y: 0, class: 'node-text'
        }, name);

        // Level count badge
        const badge = createSVGElement('text', {
            x: 0, y: height/2 - 5, 'font-size': '10px', fill: 'white', 'text-anchor': 'middle'
        }, `${info.levels.size} lvl`);

        group.appendChild(rect);
        group.appendChild(text);
        group.appendChild(badge);

        // Event Listeners
        group.addEventListener('mousedown', (e) => handleNodeMouseDown(e, name));
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            handleNodeClick(name);
        });

        els.nodesLayer.appendChild(group);
    });

    // 3. Render Edges
    model.binaryFactors.forEach(f => {
        const pos1 = visualState.nodePositions.get(f.var1);
        const pos2 = visualState.nodePositions.get(f.var2);
        
        if (pos1 && pos2) {
            const line = createSVGElement('line', {
                x1: pos1.x, y1: pos1.y, x2: pos2.x, y2: pos2.y,
                class: 'edge-line'
            });
            line.dataset.var1 = f.var1;
            line.dataset.var2 = f.var2;
            line.addEventListener('click', (e) => {
                e.stopPropagation();
                handleEdgeClick(f.var1, f.var2);
            });
            els.edgesLayer.appendChild(line);
        } else {
            console.warn(`⚠️ Missing position for edge: ${f.var1} <-> ${f.var2}`);
        }
    });

    // 4. Update Sidebar
    updateSidebar(visualState.selectedNode || visualState.selectedEdge);
    console.log("✅ Graph rendered successfully");
}

// ---- Interaction Handlers ----

function handleNodeMouseDown(e, varName) {
    e.preventDefault();
    visualState.isDragging = true;
    visualState.dragTarget = varName;
    
    const pos = visualState.nodePositions.get(varName);
    const svgPoint = getSVGPoint(e);
    
    visualState.dragOffset = {
        x: svgPoint.x - pos.x,
        y: svgPoint.y - pos.y
    };
    
    // Select the node on drag start
    handleNodeClick(varName);
}

function handleNodeClick(varName) {
    visualState.selectedNode = varName;
    visualState.selectedEdge = null;
    renderGraphFromModel(); // Re-render to update selection styles
}

function handleEdgeClick(var1, var2) {
    visualState.selectedEdge = `${var1},${var2}`;
    visualState.selectedNode = null;
    renderGraphFromModel();
}

function handleCanvasClick(e) {
    // Deselect if clicking on empty canvas
    if (e.target === els.canvas || e.target.tagName === 'rect' && e.target.id === 'grid') {
        visualState.selectedNode = null;
        visualState.selectedEdge = null;
        renderGraphFromModel();
    }
}

// Global mouse move/up for dragging
document.addEventListener('mousemove', (e) => {
    if (!visualState.isDragging || !visualState.dragTarget) return;
    
    const svgPoint = getSVGPoint(e);
    const newPos = {
        x: svgPoint.x - visualState.dragOffset.x,
        y: svgPoint.y - visualState.dragOffset.y
    };
    
    visualState.nodePositions.set(visualState.dragTarget, newPos);
    
    // Re-render edges immediately for smooth drag
    renderEdgesOnly();
});

document.addEventListener('mouseup', () => {
    visualState.isDragging = false;
    visualState.dragTarget = null;
});

// ---- Helpers ----

function getSVGPoint(e) {
    const CTM = els.canvas.getScreenCTM();
    return {
        x: (e.clientX - CTM.e) / CTM.a,
        y: (e.clientY - CTM.f) / CTM.d
    };
}

function createSVGElement(tag, attrs, textContent = null) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    if (textContent !== null) {
        el.textContent = textContent;
    }
    return el;
}

function renderEdgesOnly() {
    els.edgesLayer.innerHTML = '';
    model.binaryFactors.forEach(f => {
        const pos1 = visualState.nodePositions.get(f.var1);
        const pos2 = visualState.nodePositions.get(f.var2);
        if (pos1 && pos2) {
            const line = createSVGElement('line', {
                x1: pos1.x, y1: pos1.y, x2: pos2.x, y2: pos2.y,
                class: 'edge-line'
            });
            line.dataset.var1 = f.var1;
            line.dataset.var2 = f.var2;
            line.addEventListener('click', (e) => {
                e.stopPropagation();
                handleEdgeClick(f.var1, f.var2);
            });
            els.edgesLayer.appendChild(line);
        }
    });
}

// ---- Sidebar Logic ----

function doSaveUnaryWeights(varName) {
    const info = model.variables.get(varName);
    if (!info) return false;

    const entries = {};
    let hasChanges = false;
    let allDefault = true;

    Array.from(info.levels.keys()).forEach(lvl => {
        const input = document.getElementById(`weight-${varName}-${lvl}`);
        if (input) {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val >= 0) {
                entries[lvl] = val;
                if (val !== 1.0) {
                    hasChanges = true;
                    allDefault = false;
                }
            } else {
                // If input is invalid, treat as 1.0 (default)
                entries[lvl] = 1.0;
            }
        } else {
            // Input not found? This shouldn't happen, but fallback to 1.0
            entries[lvl] = 1.0;
        }
    });

    // If all values are 1.0, we don't need to store a factor (it's implicit)
    if (allDefault) {
        // Check if a factor exists and remove it if it's all 1s
        const existingIndex = model.unaryFactors.findIndex(f => f.variable === varName);
        if (existingIndex !== -1) {
            // Check if the existing factor is also all 1s
            const existingFactor = model.unaryFactors[existingIndex];
            const isAllOne = Array.from(existingFactor.entries.values()).every(v => v === 1.0);
            if (isAllOne) {
                // Remove it to keep the model clean
                model.unaryFactors.splice(existingIndex, 1);
                console.log(`🧹 Removed redundant unary factor for ${varName}`);
                return true; // Changed (removed)
            }
        }
        return false; // No change needed
    }

    // If we have non-default values, update or add the factor
    const existingIndex = model.unaryFactors.findIndex(f => f.variable === varName);
    if (existingIndex !== -1) {
        // Replace existing
        model.unaryFactors[existingIndex] = { type: 'unary', variable: varName, entries: new Map(Object.entries(entries)) };
        console.log(`🔄 Updated unary factor for ${varName}`);
        return true;
    } else {
        // Add new
        model.unaryFactors.push({ type: 'unary', variable: varName, entries: new Map(Object.entries(entries)) });
        console.log(`➕ Added new unary factor for ${varName}`);
        return true;
    }
}

function doSaveBinaryWeights(var1, var2) {
    const factor = model.binaryFactors.find(f => f.var1 === var1 && f.var2 === var2) || 
                   model.binaryFactors.find(f => f.var1 === var2 && f.var2 === var1);
    
    if (!factor) {
        console.warn(`⚠️ No factor found for ${var1} <-> ${var2} to update.`);
        return false;
    }

    const entries = {};
    const levels1 = Array.from(model.variables.get(var1).levels.keys());
    const levels2 = Array.from(model.variables.get(var2).levels.keys());
    
    let hasChanges = false;
    let allDefault = true;

    levels1.forEach(lvl1 => {
        levels2.forEach(lvl2 => {
            const input = document.getElementById(`edge-weight-${var1}-${var2}-${lvl1}-${lvl2}`);
            if (input) {
                const val = parseFloat(input.value);
                if (!isNaN(val) && val >= 0) {
                    entries[`${lvl1},${lvl2}`] = val;
                    if (val !== 1.0) {
                        hasChanges = true;
                        allDefault = false;
                    }
                } else {
                    entries[`${lvl1},${lvl2}`] = 1.0;
                }
            } else {
                entries[`${lvl1},${lvl2}`] = 1.0;
            }
        });
    });

    // If all values are 1.0, remove the factor
    if (allDefault) {
        const existingIndex = model.binaryFactors.findIndex(
            f => (f.var1 === var1 && f.var2 === var2) || (f.var1 === var2 && f.var2 === var1)
        );
        if (existingIndex !== -1) {
            model.binaryFactors.splice(existingIndex, 1);
            console.log(`🧹 Removed redundant binary factor for ${var1} <-> ${var2}`);
            return true;
        }
        return false;
    }

    // Update existing factor
    const existingIndex = model.binaryFactors.findIndex(
        f => (f.var1 === var1 && f.var2 === var2) || (f.var1 === var2 && f.var2 === var1)
    );
    if (existingIndex !== -1) {
        model.binaryFactors[existingIndex] = { type: 'binary', var1, var2, entries: new Map(Object.entries(entries)) };
        console.log(`🔄 Updated binary factor for ${var1} <-> ${var2}`);
        return true;
    }

    return false;
}

function updateSidebar(selection) {
    els.sidebarContent.innerHTML = '';
    
    if (!selection) {
        els.sidebarContent.innerHTML = '<p class="hint">Select a node or edge to edit properties.</p>';
        return;
    }

    if (model.variables.has(selection)) {
        // Node Selected
        const info = model.variables.get(selection);
        const isEvidence = model.evidence.has(selection);
        const evidenceLevel = isEvidence ? model.evidence.get(selection) : null;

        let html = `<h4>Variable: ${selection}</h4>`;
        html += `<p><strong>Levels:</strong> ${Array.from(info.levels.keys()).join(', ')}</p>`;
        
        // Evidence Section
        html += `<div class="evidence-section" style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 4px;">`;
        html += `<strong>Evidence:</strong><br>`;
        if (isEvidence) {
            html += `<span style="color: #27ae60; font-weight: bold;">${evidenceLevel}</span>`;
            html += `<button class="btn btn-small btn-danger" style="margin-left: 10px;" data-action="clear-evidence" data-var="${selection}">Clear</button>`;
        } else {
            html += `<select id="evidence-select-${selection}" style="margin-right: 5px;">`;
            Array.from(info.levels.keys()).forEach(lvl => {
                html += `<option value="${lvl}">${lvl}</option>`;
            });
            html += `</select>`;
            html += `<button class="btn btn-small btn-primary" data-action="set-evidence" data-var="${selection}">Set</button>`;
        }
        html += `</div>`;

        // Unary Factor Section
        html += `<div style="margin-top: 15px;"><strong>Unary Factor Weights (Optional)</strong>`;
        html += `<p style="font-size: 0.85rem; color: #7f8c8d;">Leave blank for uniform (1.0).</p>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">`;
        Array.from(info.levels.keys()).forEach(lvl => {
            const factor = model.unaryFactors.find(f => f.variable === selection);
            const val = factor ? (factor.entries.get(lvl) || 1.0) : 1.0;
            html += `<div style="display: flex; align-items: center;">`;
            html += `<span style="width: 80px; font-size: 0.9rem;">${lvl}:</span>`;
            html += `<input type="number" step="0.1" min="0" value="${val}" id="weight-${selection}-${lvl}" style="width: 60px; padding: 2px;">`;
            html += `</div>`;
        });
        html += `</div>`;
        html += `<button class="btn btn-small btn-primary" style="margin-top: 10px;" data-action="save-unary" data-var="${selection}">Apply Weights</button>`;
        html += `</div>`;

        els.sidebarContent.innerHTML = html;

    } else {
        // Edge Selected
        const [var1, var2] = selection.split(',');
        const factor = model.binaryFactors.find(f => f.var1 === var1 && f.var2 === var2) || 
                       model.binaryFactors.find(f => f.var1 === var2 && f.var2 === var1);
        
        let html = `<h4>Factor: ${var1} ↔ ${var2}</h4>`;
        
        if (!factor) {
            html += `<p>No factor data found. This might be a stale edge.</p>`;
        } else {
            html += `<p style="font-size: 0.85rem; color: #7f8c8d;">Edit weights below. Default is 1.0.</p>`;
            html += `<div style="overflow-x: auto; margin-top: 10px;">`;
            html += `<table style="border-collapse: collapse; width: 100%;">`;
            
            // Header
            html += `<tr><th></th>`;
            const levels2 = Array.from(model.variables.get(var2).levels.keys());
            levels2.forEach(lvl => html += `<th style="padding: 5px; border: 1px solid #ddd;">${lvl}</th>`);
            html += `</tr>`;
            
            // Rows
            const levels1 = Array.from(model.variables.get(var1).levels.keys());
            levels1.forEach(lvl1 => {
                html += `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: bold;">${lvl1}</td>`;
                levels2.forEach(lvl2 => {
                    const key = `${lvl1},${lvl2}`;
                    const val = factor.entries.get(key) || 1.0;
                    html += `<td style="padding: 5px; border: 1px solid #ddd;">`;
                    html += `<input type="number" step="0.1" min="0" value="${val}" id="edge-weight-${var1}-${var2}-${lvl1}-${lvl2}" style="width: 100%; box-sizing: border-box;">`;
                    html += `</td>`;
                });
                html += `</tr>`;
            });
            html += `</table>`;
            html += `</div>`;
            html += `<button class="btn btn-small btn-primary" style="margin-top: 10px;" data-action="save-binary" data-var1="${var1}" data-var2="${var2}">Apply Weights</button>`;
        }
        
        els.sidebarContent.innerHTML = html;
    }
}

// ---- Variable Management ----

function handleAddVariable() {
    clearError(els.errorVar);
    
    const name = els.varName.value.trim();
    const levelsStr = els.varLevels.value.trim();
    
    if (!name) {
        showError(els.errorVar, 'Variable name is required.');
        return;
    }
    
    if (!levelsStr) {
        showError(els.errorVar, 'At least one level is required.');
        return;
    }
    
    const levels = levelsStr.split(',').map(l => l.trim()).filter(l => l);
    
    if (levels.length === 0) {
        showError(els.errorVar, 'No valid levels found.');
        return;
    }
    
    try {
        model.addVariable(name, levels);
        els.varName.value = '';
        els.varLevels.value = '';
        renderVariables();
        updateAllDropdowns();
    } catch (err) {
        showError(els.errorVar, err.message);
    }
}

function renderVariables() {
    els.varList.innerHTML = '';
    
    for (const [name, info] of model.variables) {
        const li = document.createElement('li');
        const levelNames = Array.from(info.levels.keys()).join(', ');
        li.innerHTML = `
            <span class="item-info"><strong>${name}</strong>: ${levelNames}</span>
            <button class="btn btn-danger btn-small btn-remove" data-action="remove-var" data-id="${name}">✕</button>
        `;
        els.varList.appendChild(li);
    }
    
    // Attach event listeners to remove buttons
    els.varList.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            model.removeVariable(id);
            renderVariables();
            renderFactors();
            renderEvidence();
            updateAllDropdowns();
        });
    });
}

// ---- Factor Management ----

function toggleFactorForm() {
    const type = els.factorType.value;
    if (type === 'unary') {
        els.unaryForm.classList.remove('hidden');
        els.binaryForm.classList.add('hidden');
    } else {
        els.unaryForm.classList.add('hidden');
        els.binaryForm.classList.remove('hidden');
    }
}

function handleAddUnaryFactor() {
    clearError(els.errorFactor);
    
    const varName = els.unaryVar.value;
    const entriesStr = els.unaryEntries.value.trim();
    
    if (!varName) {
        showError(els.errorFactor, 'Select a variable.');
        return;
    }
    
    if (!entriesStr) {
        showError(els.errorFactor, 'Enter factor entries (e.g., rainy=5, sunny=2).');
        return;
    }
    
    const entries = parseSparseEntries(entriesStr, 'unary');
    if (!entries) return;
    
    try {
        model.addUnaryFactor(varName, entries);
        els.unaryEntries.value = '';
        renderFactors();
    } catch (err) {
        showError(els.errorFactor, err.message);
    }
}

function handleAddBinaryFactor() {
    clearError(els.errorFactor);
    
    const var1 = els.binaryVar1.value;
    const var2 = els.binaryVar2.value;
    const entriesStr = els.binaryEntries.value.trim();
    
    if (!var1 || !var2) {
        showError(els.errorFactor, 'Select both variables.');
        return;
    }
    
    if (var1 === var2) {
        showError(els.errorFactor, 'Cannot create a factor between a variable and itself.');
        return;
    }
    
    if (!entriesStr) {
        showError(els.errorFactor, 'Enter factor entries (e.g., rainy,sad=3).');
        return;
    }
    
    const entries = parseSparseEntries(entriesStr, 'binary');
    if (!entries) return;
    
    try {
        model.addBinaryFactor(var1, var2, entries);
        els.binaryEntries.value = '';
        renderFactors();
    } catch (err) {
        showError(els.errorFactor, err.message);
    }
}

function renderFactors() {
    els.factorList.innerHTML = '';
    
    // Render unary factors
    model.unaryFactors.forEach((factor, index) => {
        const li = document.createElement('li');
        const entriesStr = Array.from(factor.entries.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
        li.innerHTML = `
            <span class="item-info">Unary: <strong>${factor.variable}</strong> → ${entriesStr}</span>
            <button class="btn btn-danger btn-small btn-remove" data-action="remove-unary" data-index="${index}">✕</button>
        `;
        els.factorList.appendChild(li);
    });
    
    // Render binary factors
    model.binaryFactors.forEach((factor, index) => {
        const li = document.createElement('li');
        const entriesStr = Array.from(factor.entries.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
        li.innerHTML = `
            <span class="item-info">Binary: <strong>${factor.var1}</strong>, <strong>${factor.var2}</strong> → ${entriesStr}</span>
            <button class="btn btn-danger btn-small btn-remove" data-action="remove-binary" data-index="${index}">✕</button>
        `;
        els.factorList.appendChild(li);
    });
    
    // Attach event listeners
    els.factorList.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const index = parseInt(e.target.dataset.index);
            
            if (action === 'remove-unary') {
                model.removeUnaryFactor(index);
            } else if (action === 'remove-binary') {
                model.removeBinaryFactor(index);
            }
            
            renderFactors();
        });
    });
}

// ---- Evidence Management ----

function handleSetEvidence() {
    clearError(els.errorEvidence);
    
    const varName = els.evidenceVar.value;
    const levelName = els.evidenceLevel.value;
    
    if (!varName || !levelName) {
        showError(els.errorEvidence, 'Select both variable and level.');
        return;
    }
    
    try {
        model.setEvidence(varName, levelName);
        renderEvidence();
    } catch (err) {
        showError(els.errorEvidence, err.message);
    }
}

function renderEvidence() {
    els.evidenceList.innerHTML = '';
    
    for (const [varName, levelName] of model.evidence) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-info"><strong>${varName}</strong> = ${levelName}</span>
            <button class="btn btn-danger btn-small btn-remove" data-action="remove-evidence" data-var="${varName}">✕</button>
        `;
        els.evidenceList.appendChild(li);
    }
    
    // Attach event listeners
    els.evidenceList.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const varName = e.target.dataset.var;
            model.clearEvidence(varName);
            renderEvidence();
        });
    });
}

// ---- Inference ----

async function handleInference() {
    if (!wasmLoaded) {
        alert('WASM module is still loading. Please wait...');
        return;
    }
    
    const iterations = parseInt(els.iterations.value) || 20;
    
    els.btnInfer.disabled = true;
    els.loading.textContent = 'Running inference...';
    els.loading.classList.remove('hidden');
    els.resultsContainer.innerHTML = '';
    
    try {
        const marginals = await model.infer(iterations);
        renderResults(marginals);
    } catch (err) {
        els.resultsContainer.innerHTML = `<div class="error-message" style="padding: 10px;">Inference failed: ${err.message}</div>`;
    } finally {
        els.btnInfer.disabled = false;
        els.loading.classList.add('hidden');
    }
}

function renderResults(marginals) {
    els.resultsContainer.innerHTML = '';
    
    for (const [varName, levelProbs] of marginals) {
        const varDiv = document.createElement('div');
        varDiv.className = 'result-variable';
        
        const title = document.createElement('h3');
        title.textContent = varName;
        varDiv.appendChild(title);
        
        // Sort levels by probability descending
        const sortedLevels = Array.from(levelProbs.entries())
            .sort((a, b) => b[1] - a[1]);
        
        for (const [levelName, prob] of sortedLevels) {
            const row = document.createElement('div');
            row.className = 'result-level';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'level-name';
            nameSpan.textContent = levelName;
            
            const barContainer = document.createElement('div');
            barContainer.className = 'bar-container';
            
            const barFill = document.createElement('div');
            barFill.className = 'bar-fill';
            barFill.style.width = `${prob * 100}%`;
            
            const probSpan = document.createElement('span');
            probSpan.className = 'probability';
            probSpan.textContent = prob.toFixed(4);
            
            barContainer.appendChild(barFill);
            row.appendChild(nameSpan);
            row.appendChild(barContainer);
            row.appendChild(probSpan);
            varDiv.appendChild(row);
        }
        
        els.resultsContainer.appendChild(varDiv);
    }
}

// ---- Utilities ----

function updateAllDropdowns() {
    const vars = Array.from(model.variables.keys());
    
    // Update all variable selects
    const selects = [els.unaryVar, els.binaryVar1, els.binaryVar2, els.evidenceVar];
    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">-- Select --</option>';
        vars.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        });
        // Restore selection if possible
        if (vars.includes(currentVal)) sel.value = currentVal;
    });
    
    // Update level dropdown based on selected variable
    updateLevelDropdown();
    
    // Listen for variable changes to update levels
    els.evidenceVar.addEventListener('change', updateLevelDropdown);
}

function updateLevelDropdown() {
    const varName = els.evidenceVar.value;
    els.evidenceLevel.innerHTML = '<option value="">-- Select Level --</option>';
    
    if (varName && model.variables.has(varName)) {
        const info = model.variables.get(varName);
        Array.from(info.levels.keys()).forEach(level => {
            const opt = document.createElement('option');
            opt.value = level;
            opt.textContent = level;
            els.evidenceLevel.appendChild(opt);
        });
    }
}

function parseSparseEntries(str, type) {
    const entries = {};

    if (type === 'unary') {
        // Unary: split on comma, each piece is "level=value"
        const pairs = str.split(',');
        for (const pair of pairs) {
            const trimmed = pair.trim();
            if (!trimmed) continue;

            const parts = trimmed.split('=');
            if (parts.length !== 2) {
                showError(els.errorFactor, `Invalid entry format: "${trimmed}". Expected "level=value".`);
                return null;
            }
            const key = parts[0].trim();
            const value = parseFloat(parts[1].trim());

            if (isNaN(value) || value < 0) {
                showError(els.errorFactor, `Invalid value for "${key}": must be a non-negative number.`);
                return null;
            }
            entries[key] = value;
        }
    } else {
        // Binary: use regex to match "level1,level2=value" patterns
        // This avoids the ambiguity of comma as both entry separator and level separator
        const regex = /([^,=]+)\s*,\s*([^,=]+)\s*=\s*([\d.eE+-]+)/g;
        let match;
        let matchCount = 0;

        while ((match = regex.exec(str)) !== null) {
            matchCount++;
            const level1 = match[1].trim();
            const level2 = match[2].trim();
            const value = parseFloat(match[3].trim());
            const key = `${level1},${level2}`;

            if (isNaN(value) || value < 0) {
                showError(els.errorFactor, `Invalid value for "${key}": must be a non-negative number.`);
                return null;
            }
            entries[key] = value;
        }

        if (matchCount === 0) {
            showError(els.errorFactor, 'No valid entries found. Expected format: "level1,level2=value, ...".');
            return null;
        }
    }

    if (Object.keys(entries).length === 0) {
        showError(els.errorFactor, 'No valid entries found.');
        return null;
    }

    return entries;
}

function showError(el, message) {
    el.textContent = message;
    el.style.display = 'block';
}

function clearError(el) {
    el.textContent = '';
    el.style.display = 'none';
}

function handleReset() {
    if (!confirm('Are you sure you want to clear all variables, factors, and evidence?')) return;
    
    model.reset();
    els.varName.value = '';
    els.varLevels.value = '';
    els.unaryEntries.value = '';
    els.binaryEntries.value = '';
    els.evidenceLevel.value = '';
    els.resultsContainer.innerHTML = '';
    
    renderVariables();
    renderFactors();
    renderEvidence();
    updateAllDropdowns();
}

// Start the app
init();