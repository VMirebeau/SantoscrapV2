cancel = false;

// Fonction pour charger un script externe avec une promesse
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => {
            reject(`Erreur lors du chargement du script ${url}`);
        };
        document.head.appendChild(script);
    });
}

// Fonction pour obtenir le contenu binaire d'une URL avec une promesse
function getBinaryContent(url) {
    return new Promise((resolve, reject) => {
        JSZipUtils.getBinaryContent(url, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Fonction pour trouver le bouton de téléchargement
function findDownloadButton() {
    return document.querySelector('a[href*="/th/copie/"][href*="/download"]');
}

// Fonction pour trouver le bouton suivant
function findNextButton() {
    return document.querySelector('a[title*="suivante"], a[title*="Suivante"]');
}

// Fonction pour extraire tous les liens de téléchargement en naviguant
async function extractAllDownloadLinks() {
    const links = [];
    const visitedLinks = new Set();
    let currentIndex = 1;
    
    // Afficher la popup de scan
    showScanPopup();
    
    while (true) {
        if (cancel) {
            break;
        }
        
        // Trouver le bouton de téléchargement actuel
        const downloadButton = findDownloadButton();
        if (!downloadButton) {
            throw new Error("Bouton de téléchargement introuvable sur cette page");
        }
        
        const href = downloadButton.getAttribute('href');
        const fullUrl = 'https://santorin.examens-concours.gouv.fr' + href;
        
        // Vérifier si on a déjà visité ce lien (tour complet)
        if (visitedLinks.has(fullUrl)) {
            console.log("Tour complet détecté, arrêt de la navigation");
            break;
        }
        
        // Ajouter le lien à notre collection
        links.push({
            Id: fullUrl,
            NomCopie: `Copie_${currentIndex.toString().padStart(3, '0')}`
        });
        visitedLinks.add(fullUrl);
        
        // Mettre à jour l'affichage du scan
        updateScanProgress(currentIndex, fullUrl);
        
        console.log(`Copie ${currentIndex} trouvée: ${fullUrl}`);
        
        // Trouver le bouton suivant
        const nextButton = findNextButton();
        if (!nextButton) {
            console.log("Bouton suivant introuvable, fin de la navigation");
            break;
        }
        
        // Cliquer sur le bouton suivant
        nextButton.click();
        
        // Attendre que la page se charge
        await waitForPageLoad();
        
        currentIndex++;
        
        // Sécurité : limite à 1000 copies pour éviter les boucles infinies
        if (currentIndex > 1000) {
            throw new Error("Limite de sécurité atteinte (1000 copies). Arrêt du scan.");
        }
    }
    
    closeScanPopup();
    return links;
}

// Fonction pour attendre le chargement de la page
function waitForPageLoad() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1000); // Attendre 1 seconde pour le chargement
    });
}

// Fonction pour télécharger toutes les copies
async function downloadAllFiles() {
    try {
        const copies = await extractAllDownloadLinks();
        if (copies.length === 0) {
            throw new Error("Aucune copie trouvée");
        }
        console.log(`${copies.length} copies trouvées, début du téléchargement`);
        await downloadFiles(copies);
    } catch (error) {
        console.error("Erreur lors de l'extraction des liens:", error);
        erreur("Erreur lors de l'extraction des liens: " + error.message);
    }
}

// Fonction pour télécharger les copies avec mise à jour de la progression
async function downloadFiles(copies) {
    cancel = false;
    const zip = new JSZip();
    let fileCount = 1;
    const totalFiles = copies.length;
    const startTime = Date.now();

    // Afficher la popup de progression
    showProgressPopup(totalFiles);

    for (const copy of copies) {
        if (cancel) {
            break;
        }
        
        const url = copy.Id;
        const fileName = copy.NomCopie + ".pdf";
        try {
            console.log(`Téléchargement du fichier ${fileCount}/${totalFiles} : ${fileName}`);
            const data = await getBinaryContent(url);
            zip.file(fileName, data, { binary: true });

            // Mettre à jour la progression
            updateProgress(fileCount, totalFiles, startTime);

            fileCount++;
        } catch (error) {
            console.error(`Erreur lors du téléchargement du fichier ${fileName} :`, error);
            if (!cancel) erreur(`Erreur lors du téléchargement du fichier ${fileName} : ${error}`);
        }
    }

    if (!cancel) {
        try {
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "Fichiers.zip");
            console.log("Exportation du zip terminée.");

            // Appeler la fonction pour gérer la fin du téléchargement
            completeDownload();

        } catch (error) {
            console.error("Erreur lors de la création du fichier zip :", error);
            if (!cancel) erreur("Erreur lors de la création du fichier zip : " + error);
        }
    }
}

// Fonction pour afficher la popup de scan
function showScanPopup() {
    // Création de l'arrière-plan gris
    const overlay = document.createElement('div');
    overlay.id = 'scan-popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 1000;

    // Création de la popup
    const popup = document.createElement('div');
    popup.id = 'scan-popup';
    popup.style.width = '400px';
    popup.style.height = '250px';
    popup.style.backgroundColor = 'white';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    popup.style.padding = '20px';
    popup.style.textAlign = 'center';
    popup.style.position = 'relative';

    // Titre de la popup
    const title = document.createElement('h3');
    title.textContent = "Scan des copies en cours...";
    title.style.marginBottom = '15px';

    // Texte d'information
    const infoText = document.createElement('p');
    infoText.id = 'scan-info';
    infoText.textContent = "Recherche des copies disponibles...";
    infoText.style.marginBottom = '20px';

    // URL actuelle
    const urlText = document.createElement('p');
    urlText.id = 'scan-url';
    urlText.style.fontSize = '12px';
    urlText.style.color = '#666';
    urlText.style.marginBottom = '20px';
    urlText.style.wordBreak = 'break-all';

    // Bouton Annuler
    const cancelButton = document.createElement('button');
    cancelButton.textContent = "Annuler";
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.addEventListener('click', () => {
        cancel = true;
        closeScanPopup();
    });

    // Ajouter les éléments à la popup
    popup.appendChild(title);
    popup.appendChild(infoText);
    popup.appendChild(urlText);
    popup.appendChild(cancelButton);

    // Ajouter la popup et l'arrière-plan au document
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// Fonction pour mettre à jour le scan
function updateScanProgress(count, url) {
    const infoText = document.getElementById('scan-info');
    const urlText = document.getElementById('scan-url');
    
    if (infoText) {
        infoText.textContent = `${count} copie(s) trouvée(s)`;
    }
    
    if (urlText) {
        urlText.textContent = url;
    }
}

// Fonction pour fermer la popup de scan
function closeScanPopup() {
    const overlay = document.getElementById('scan-popup-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

// Fonction pour afficher la popup principale
function showPopup() {
    // Création de l'arrière-plan gris
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 1000;

    // Création de la popup
    const popup = document.createElement('div');
    popup.style.width = '400px';
    popup.style.height = '250px';
    popup.style.backgroundColor = 'white';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    popup.style.padding = '20px';
    popup.style.textAlign = 'center';
    popup.style.position = 'relative';

    // Titre de la popup
    const title = document.createElement('h2');
    title.textContent = "SantoScrap v4";
    title.style.marginBottom = '20px';

    // Description
    const description = document.createElement('p');
    description.textContent = "Le script va scanner toutes les copies en naviguant avec le bouton 'Suivante' puis télécharger l'ensemble.";
    description.style.marginBottom = '30px';
    description.style.fontSize = '14px';

    // Conteneur pour le bouton Télécharger
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'center';

    // Bouton Télécharger
    const downloadButton = document.createElement('button');
    downloadButton.textContent = "Démarrer le scan et téléchargement";
    downloadButton.style.padding = '10px 20px';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.backgroundColor = '#4CAF50';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '4px';

    // Gestion du clic sur le bouton Télécharger
    downloadButton.addEventListener('click', () => {
        closePopup();
        downloadAllFiles();
    });

    // Assemblage des éléments dans la popup
    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(buttonContainer);
    buttonContainer.appendChild(downloadButton);

    // Assemblage final de la popup et de l'overlay à la page
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Gestion du clic en dehors de la popup pour fermer
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePopup();
        }
    });
}

// Fonction pour fermer la popup
function closePopup() {
    const overlay = document.querySelector('.popup-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

// Fonction pour afficher la popup de progression
function showProgressPopup(totalFiles) {
    // Création de l'arrière-plan gris
    const overlay = document.createElement('div');
    overlay.id = 'progress-popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 1000;

    // Création de la popup
    const popup = document.createElement('div');
    popup.id = 'progress-popup';
    popup.style.width = '400px';
    popup.style.height = '300px';
    popup.style.backgroundColor = 'white';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    popup.style.padding = '20px';
    popup.style.textAlign = 'center';
    popup.style.position = 'relative';

    // Titre de la popup
    const title = document.createElement('h3');
    title.textContent = "Téléchargement en cours...";
    title.style.marginBottom = '15px';

    // Barre de progression
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.width = '100%';
    progressBarContainer.style.backgroundColor = '#e0e0e0';
    progressBarContainer.style.borderRadius = '5px';
    progressBarContainer.style.marginBottom = '15px';

    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#4caf50';
    progressBar.style.borderRadius = '5px';
    progressBar.style.transition = 'width 0.3s ease-in-out';

    progressBarContainer.appendChild(progressBar);

    // Texte d'information
    const infoText = document.createElement('p');
    infoText.id = 'progress-info';
    infoText.textContent = `0 / ${totalFiles} fichiers`;

    // Bouton Annuler
    const cancelButton = document.createElement('button');
    cancelButton.textContent = "Annuler";
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.marginTop = '15px';
    cancelButton.addEventListener('click', () => {
        cancel = true;
        closeProgressPopup();
        showPopup();
    });

    // Ajouter les éléments à la popup
    popup.appendChild(title);
    popup.appendChild(progressBarContainer);
    popup.appendChild(infoText);
    popup.appendChild(cancelButton);

    // Ajouter la popup et l'arrière-plan au document
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// Fonction pour fermer la popup de progression
function closeProgressPopup() {
    const overlay = document.getElementById('progress-popup-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

// Fonction pour gérer la fin du téléchargement
function completeDownload() {
    const popup = document.getElementById('progress-popup');
    const infoText = document.getElementById('progress-info');
    const cancelButton = document.getElementById('cancel-button');

    // Mettre à jour le texte de la popup
    if (infoText) {
        infoText.textContent = "Retrouvez votre PDF dans vos téléchargements.";
    }
    
    // Remplacer le bouton Annuler par un bouton Ok
    if (cancelButton) {
        cancelButton.textContent = "Ok";
        cancelButton.replaceWith(cancelButton.cloneNode(true));
        const newCancelButton = popup.querySelector('button');
        newCancelButton.addEventListener('click', () => {
            closeProgressPopup();
            showPopup();
        });
    }
}

// Fonction pour mettre à jour la progression
function updateProgress(current, total, startTime) {
    const progressBar = document.getElementById('progress-bar');
    const infoText = document.getElementById('progress-info');
    
    if (!progressBar || !infoText) return;
    
    const progressPercentage = (current / total) * 100;
    progressBar.style.width = `${progressPercentage}%`;
    infoText.textContent = `${current} / ${total} fichiers`;

    const elapsedTime = (Date.now() - startTime) / 1000;
    const estimatedTotalTime = (elapsedTime / current) * total;
    const remainingTime = estimatedTotalTime - elapsedTime;

    let remainingTimeFormatted;
    if (remainingTime >= 60) {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = Math.ceil(remainingTime % 60);
        remainingTimeFormatted = `${minutes} min ${seconds} s`;
    } else {
        remainingTimeFormatted = `${Math.ceil(remainingTime)} s`;
    }

    if (current < total) {
        infoText.textContent += ` - Temps restant estimé: ${remainingTimeFormatted}`;
    } else {
        infoText.textContent = "Votre PDF est en construction, veuillez patienter... (comptez moins de 5 minutes)";
    }
}

// Fonction pour afficher une popup d'erreur
function erreur(message) {
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'error-overlay';
    errorOverlay.style.position = 'fixed';
    errorOverlay.style.top = 0;
    errorOverlay.style.left = 0;
    errorOverlay.style.width = '100%';
    errorOverlay.style.height = '100%';
    errorOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    errorOverlay.style.display = 'flex';
    errorOverlay.style.justifyContent = 'center';
    errorOverlay.style.alignItems = 'center';
    errorOverlay.style.zIndex = 2000;

    const errorPopup = document.createElement('div');
    errorPopup.style.width = '300px';
    errorPopup.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    errorPopup.style.borderRadius = '8px';
    errorPopup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    errorPopup.style.padding = '20px';
    errorPopup.style.textAlign = 'center';
    errorPopup.style.position = 'relative';

    const errorTitle = document.createElement('h3');
    errorTitle.textContent = "Erreur !";
    errorTitle.style.marginBottom = '10px';
    errorTitle.style.color = 'white';

    const errorMessage = document.createElement('p');
    errorMessage.textContent = message;
    errorMessage.style.marginBottom = '20px';
    errorMessage.style.color = 'white';

    const okButton = document.createElement('button');
    okButton.textContent = "OK";
    okButton.style.padding = '10px 20px';
    okButton.style.cursor = 'pointer';
    okButton.style.backgroundColor = 'white';
    okButton.style.color = 'black';
    okButton.addEventListener('click', () => {
        closeErrorPopup();
    });

    errorPopup.appendChild(errorTitle);
    errorPopup.appendChild(errorMessage);
    errorPopup.appendChild(okButton);
    errorOverlay.appendChild(errorPopup);
    document.body.appendChild(errorOverlay);

    errorOverlay.addEventListener('click', (e) => {
        if (e.target === errorOverlay) {
            closeErrorPopup();
        }
    });
}

// Fonction pour fermer la popup d'erreur
function closeErrorPopup() {
    const errorOverlay = document.querySelector('.error-overlay');
    if (errorOverlay) {
        document.body.removeChild(errorOverlay);
    }
}

// Fonction pour charger les dépendances avec async/await et gestion des erreurs
async function loadDependencies() {
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip-utils/0.0.2/jszip-utils.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
        console.log("Toutes les dépendances ont été chargées avec succès.");
    } catch (error) {
        console.error("Erreur lors du chargement des scripts :", error);
        erreur(error);
        throw new Error("Erreur lors du chargement des dépendances.");
    }
}

// Fonction pour vérifier et initialiser le script
function initializeScraper() {
    // Vérifier que nous sommes sur la bonne page
    const currentUrl = window.location.href;
    
    if (!currentUrl.includes('santorin.examens-concours.gouv.fr')) {
        erreur("Ce script ne fonctionne que sur le site Santorin.");
        return;
    }
    
    // Vérifier la présence des boutons nécessaires
    const downloadButton = findDownloadButton();
    const nextButton = findNextButton();
    
    if (!downloadButton) {
        erreur("Bouton de téléchargement introuvable. Assurez-vous d'être sur une page de copie.");
        return;
    }
    
    if (!nextButton) {
        erreur("Bouton 'Suivante' introuvable. Assurez-vous d'être sur une page avec navigation entre copies.");
        return;
    }
    
    console.log("Boutons détectés, chargement des dépendances...");
    
    // Charger les dépendances et afficher la popup
    loadDependencies().then(() => {
        console.log("Dépendances chargées, prêt à démarrer.");
        showPopup();
    }).catch((error) => {
        erreur("Erreur lors du chargement des dépendances: " + error.message);
    });
}

// Démarrer le script
initializeScraper();
