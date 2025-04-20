class MemoryObject {
    constructor(id, name, size) {
        this.id = id;
        this.name = name;
        this.size = size;
        this.references = new Set();
        this.referenceCount = 0;
        this.marked = false;
    }
}

class GarbageCollector {
    constructor() {
        this.heap = new Map();
        this.totalMemory = 1024; // MB
        this.usedMemory = 0;
        this.gcCycles = 0;
        this.nextId = 1;
        this.rootObjects = new Set();
        
        this.initializeUI();
        this.attachEventListeners();
        this.updateStats();
    }

    initializeUI() {
        // Initialize UI elements
        this.objectNameInput = document.getElementById('objectName');
        this.objectSizeInput = document.getElementById('objectSize');
        this.fromObjectSelect = document.getElementById('fromObject');
        this.toObjectSelect = document.getElementById('toObject');
        this.heapVisualization = document.getElementById('heapVisualization');
        this.referenceGraph = document.getElementById('referenceGraph');
        this.eventLog = document.getElementById('eventLog');
    }

    attachEventListeners() {
        // Create object button
        document.getElementById('createObject').addEventListener('click', () => {
            this.createObject();
        });

        // Create reference button
        document.getElementById('createReference').addEventListener('click', () => {
            this.createReference();
        });

        // Run GC button
        document.getElementById('runGC').addEventListener('click', () => {
            this.runGarbageCollection();
        });
    }

    createObject() {
        const name = this.objectNameInput.value.trim() || `Object_${this.nextId}`;
        const size = parseInt(this.objectSizeInput.value) || 10;

        if (this.usedMemory + size > this.totalMemory) {
            this.log('Error: Not enough memory available', 'error');
            return;
        }

        const object = new MemoryObject(this.nextId++, name, size);
        this.heap.set(object.id, object);
        this.rootObjects.add(object.id);
        this.usedMemory += size;

        this.log(`Created object: ${name} (${size} MB)`, 'success');
        this.updateUI();
    }

    createReference() {
        const fromId = parseInt(this.fromObjectSelect.value);
        const toId = parseInt(this.toObjectSelect.value);

        if (fromId === toId) {
            this.log('Error: Cannot create self-reference', 'error');
            return;
        }

        const fromObject = this.heap.get(fromId);
        const toObject = this.heap.get(toId);

        if (fromObject && toObject) {
            fromObject.references.add(toId);
            toObject.referenceCount++;
            this.rootObjects.delete(toId);

            this.log(`Created reference: ${fromObject.name} → ${toObject.name}`, 'info');
            this.updateUI();
        }
    }

    runGarbageCollection() {
        const algorithm = document.querySelector('input[name="gcAlgorithm"]:checked').value;
        
        this.gcCycles++;
        this.log(`Starting garbage collection cycle ${this.gcCycles}`, 'warning');

        if (algorithm === 'markAndSweep') {
            this.markAndSweep();
        } else {
            this.referenceCount();
        }

        this.updateStats();
        this.updateUI();
    }

    markAndSweep() {
        // Mark phase
        this.heap.forEach(obj => obj.marked = false);
        this.rootObjects.forEach(id => this.mark(this.heap.get(id)));

        // Sweep phase
        const garbage = [];
        this.heap.forEach((obj, id) => {
            if (!obj.marked) {
                garbage.push(id);
                this.usedMemory -= obj.size;
            }
        });

        // Remove garbage
        garbage.forEach(id => {
            const obj = this.heap.get(id);
            this.log(`Collected: ${obj.name} (${obj.size} MB)`, 'warning');
            this.heap.delete(id);
        });
    }

    mark(object) {
        if (!object || object.marked) return;
        
        object.marked = true;
        object.references.forEach(id => {
            this.mark(this.heap.get(id));
        });
    }

    referenceCount() {
        const garbage = [];
        this.heap.forEach((obj, id) => {
            if (obj.referenceCount === 0 && !this.rootObjects.has(id)) {
                garbage.push(id);
                this.usedMemory -= obj.size;
            }
        });

        garbage.forEach(id => {
            const obj = this.heap.get(id);
            this.log(`Collected: ${obj.name} (${obj.size} MB)`, 'warning');
            
            // Update reference counts
            obj.references.forEach(refId => {
                const refObj = this.heap.get(refId);
                if (refObj) {
                    refObj.referenceCount--;
                }
            });

            this.heap.delete(id);
        });
    }

    updateUI() {
        this.updateHeapVisualization();
        this.updateReferenceGraph();
        this.updateObjectSelects();
        this.updateStats();
    }

    updateHeapVisualization() {
        this.heapVisualization.innerHTML = '';
        
        this.heap.forEach(obj => {
            const objectEl = document.createElement('div');
            objectEl.className = `heap-object ${obj.marked ? 'marked' : ''}`;
            objectEl.innerHTML = `
                <h3>${obj.name}</h3>
                <div class="size">${obj.size} MB</div>
                <div class="refs">Refs: ${obj.referenceCount}</div>
            `;
            this.heapVisualization.appendChild(objectEl);
        });
    }

    updateReferenceGraph() {
        this.referenceGraph.innerHTML = '';
        const nodes = new Map();
        const nodeSize = 40;
        const padding = 20;
        
        // Create nodes
        let x = padding;
        let y = padding;
        this.heap.forEach(obj => {
            const node = document.createElement('div');
            node.className = `graph-node ${this.rootObjects.has(obj.id) ? 'root' : ''}`;
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            node.style.width = `${nodeSize}px`;
            node.style.height = `${nodeSize}px`;
            node.textContent = obj.name.slice(0, 2);
            node.title = obj.name;
            
            this.referenceGraph.appendChild(node);
            nodes.set(obj.id, { x: x + nodeSize/2, y: y + nodeSize/2 });
            
            x += nodeSize + padding;
            if (x > this.referenceGraph.offsetWidth - nodeSize - padding) {
                x = padding;
                y += nodeSize + padding;
            }
        });
        
        // Create edges
        this.heap.forEach(obj => {
            const fromPos = nodes.get(obj.id);
            obj.references.forEach(toId => {
                const toPos = nodes.get(toId);
                if (fromPos && toPos) {
                    const edge = document.createElement('div');
                    edge.className = 'graph-edge';
                    
                    const dx = toPos.x - fromPos.x;
                    const dy = toPos.y - fromPos.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    
                    edge.style.width = `${length}px`;
                    edge.style.left = `${fromPos.x}px`;
                    edge.style.top = `${fromPos.y}px`;
                    edge.style.transform = `rotate(${angle}deg)`;
                    
                    this.referenceGraph.appendChild(edge);
                }
            });
        });
    }

    updateObjectSelects() {
        const options = Array.from(this.heap.values()).map(obj => 
            `<option value="${obj.id}">${obj.name}</option>`
        ).join('');
        
        this.fromObjectSelect.innerHTML = options;
        this.toObjectSelect.innerHTML = options;
    }

    updateStats() {
        document.getElementById('totalMemory').textContent = `${this.totalMemory} MB`;
        document.getElementById('usedMemory').textContent = `${this.usedMemory} MB`;
        document.getElementById('gcCycles').textContent = this.gcCycles;
    }

    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.eventLog.insertBefore(entry, this.eventLog.firstChild);
    }
}

// Initialize the garbage collector when the page loads
window.addEventListener('load', () => {
    window.gc = new GarbageCollector();
});