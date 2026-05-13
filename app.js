// ... ovdje ide tvoj kod klase koji već imaš ...

// --- DODATAK ZA KAMERU (zalijepi na kraj app.js) ---
(async () => {
    const video = document.getElementById('video');
    const predictions = document.getElementById('predictions');
    const status = document.getElementById('status');

    let classifier = new EdgeImpulseClassifier();
    
    try {
        await classifier.init();
        status.innerText = "Model spreman. Pokrećem analizu...";

        // Pokretanje kamere
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" } 
        });
        video.srcObject = stream;

        // Petlja koja svakih 300ms šalje sliku modelu
        setInterval(async () => {
            if (video.paused || video.ended) return;

            const props = classifier.getProperties();
            const width = props.input_width || 96;
            const height = props.input_height || 96;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(video, 0, 0, width, height);
            
            const imgData = tempCtx.getImageData(0, 0, width, height);
            let features = [];
            for (let i = 0; i < imgData.data.length; i += 4) {
                features.push((imgData.data[i] << 16) | (imgData.data[i+1] << 8) | imgData.data[i+2]);
            }

            try {
                let result = classifier.classify(features);
                predictions.innerHTML = "";
                result.results.forEach(res => {
                    predictions.innerHTML += `<div>${res.label}: ${(res.value * 100).toFixed(1)}%</div>`;
                });
            } catch (e) { console.error(e); }
        }, 300);
    } catch (err) {
        status.innerText = "Greška: " + err.message;
    }
})();