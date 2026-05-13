// --- 1. TVOJA KLASA (EdgeImpulseClassifier) ---
let classifierInitialized = false;
Module.onRuntimeInitialized = function() {
    classifierInitialized = true;
};

class EdgeImpulseClassifier {
    init() {
        if (classifierInitialized === true) return Promise.resolve();
        return new Promise((resolve, reject) => {
            Module.onRuntimeInitialized = () => {
                classifierInitialized = true;
                let ret = Module.init();
                if (typeof ret === 'number' && ret != 0) return reject('init() failed with code ' + ret);
                resolve();
            };
        });
    }
    getProperties() {
        return this._convertToOrdinaryJsObject(Module.get_properties(), Module.emcc_classification_properties_t.prototype);
    }
    classify(rawData) {
        const obj = this._arrayToHeap(rawData);
        let ret = Module.run_classifier(obj.buffer.byteOffset, rawData.length, false);
        Module._free(obj.ptr);
        return this._fillResultStruct(ret);
    }
    _arrayToHeap(data) {
        let typedArray = new Float32Array(data);
        let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
        let ptr = Module._malloc(numBytes);
        let heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
        heapBytes.set(new Uint8Array(typedArray.buffer));
        return { ptr: ptr, buffer: heapBytes };
    }
    _convertToOrdinaryJsObject(emboundObj, prototype) {
        let newObj = {};
        for (const key of Object.getOwnPropertyNames(prototype)) {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
            if (descriptor && typeof descriptor.get === 'function') newObj[key] = emboundObj[key];
        }
        return newObj;
    }
    _fillResultStruct(ret) {
        let props = Module.get_properties();
        let jsResult = { results: [] };
        for (let cx = 0; cx < ret.size(); cx++) {
            let c = ret.get(cx);
            jsResult.results.push({ label: c.label, value: c.value });
            c.delete();
        }
        ret.delete();
        return jsResult;
    }
}

// --- 2. LOGIKA ZA GUMB I KAMERU ---
window.onload = function() {
    const btn = document.getElementById('start-btn');
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    const predictions = document.getElementById('predictions');

    btn.addEventListener('click', async () => {
        btn.style.display = 'none'; // Sakrij gumb odmah nakon klika
        status.innerText = "Pokretanje... Molimo odobrite kameru.";

        try {
            // Prvo tražimo kameru (ovo će izbaciti prozorčić za "Allow")
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            video.srcObject = stream;
            
            // Inicijaliziramo model
            let classifier = new EdgeImpulseClassifier();
            await classifier.init();
            status.innerText = "Sustav aktivan!";

            // Pokreni analizu svake sekunde
            setInterval(() => {
                const props = classifier.getProperties();
                const width = props.input_width || 96;
                const height = props.input_height || 96;

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, width, height);

                const imgData = ctx.getImageData(0, 0, width, height);
                let features = [];
                for (let i = 0; i < imgData.data.length; i += 4) {
                    features.push((imgData.data[i] << 16) | (imgData.data[i+1] << 8) | imgData.data[i+2]);
                }

                let result = classifier.classify(features);
                predictions.innerHTML = result.results
                    .map(r => `<div>${r.label}: ${(r.value * 100).toFixed(1)}%</div>`)
                    .join('');
            }, 1000);

        } catch (err) {
            status.innerText = "Greška: " + err.message;
            console.error(err);
            btn.style.display = 'block';
        }
    });
};