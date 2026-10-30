# DSH Voice Conversation — guida italiana

Maintainer / autore del fork: **[RedHunt07](https://github.com/redhunt07)** · License: **MIT**. Original Voice Loop code by ZG2017; see [NOTICE.md](NOTICE.md).
Conversazione vocale continua italiano/inglese: parli, fai una pausa di 1,7 secondi e il prompt viene inviato. Dopo la risposta vocale torna in ascolto. La barra compatta lascia visibili chat, strumenti e Think reso disponibile da DSH.

Versione iniziale **0.1.0**, verificata con **DSH 0.2.0-rc.2**, Node.js 22+ e Linux. I test automatici simulano il microfono: prima di una release stabile serve una prova prolungata in ambienti reali.

## Installazione

```sh
dsh plugin --profile web add https://raw.githubusercontent.com/redhunt07/dsh-voice-conversation/main/dist/dsh-voice-conversation-0.1.0.tgz
```

Il comando DSH seleziona anche il bundle. Verifica che `"dsh-voice-conversation"` compaia una sola volta in `dsh.profile.bundles` in `~/.dsh/profiles/web/package.json`; aggiungilo solo se manca, conservando le altre voci. Con `DSH_HOME` personalizzato, il profilo è sotto quella cartella. Disabilita il vecchio Voice Loop prima di attivare questo fork: usano le stesse API. Riavvia DSH e ricarica con Ctrl+Shift+R.

## Backend locale opzionale

Estrai l'archivio sorgente e apri un terminale nella cartella estratta. Prerequisiti: `python3`, `uv`, `ffmpeg`. Consulta [crediti e licenze](NOTICE.md), poi:

```sh
python3 scripts/runtime.py setup --device cpu
python3 scripts/runtime.py start
```

Con driver NVIDIA CUDA 12 compatibile su Linux puoi usare `setup --device cuda`. Verificato su GPU da 16 GB. Su CPU large-v3 può essere lento. Setup crea un ambiente Python 3.12 separato, scarica l'interprete se necessario e circa 3,1 GB di modelli. Non installa driver, pacchetti di sistema o servizi automatici.

Lascia il processo aperto; Ctrl+C lo ferma. `python3 scripts/runtime.py doctor` mostra la diagnostica. Dati in `~/.local/share/dsh-voice-conversation`; `--data-dir` cambia destinazione. Whisper usa anche la cache standard Hugging Face.

## Uso

Attiva Voice Mode nella chat, consenti il microfono e scegli riconoscimento/sintesi locali. Voce `paola` per italiano, `lessac` per inglese. Il riconoscimento sceglie automaticamente fra italiano e inglese; la voce di risposta resta quella selezionata.

Dopo la pausa il prompt parte; dopo la risposta deve tornare “Ti ascolto”. Puoi interrompere parlando; le cuffie riducono false interruzioni da eco. Le approvazioni restano nella chat e possono richiedere un clic. Chiudi Voice Mode per liberare il microfono.

Il plugin usa localhost:8766. I due slot local/cloud inizialmente sono entrambi locali. Puoi configurare endpoint remoti esplicitamente dalle impostazioni. Non ci sono fallback remoti impliciti. Il backend non salva registrazioni, ma prompt e risposte restano nella cronologia DSH; il modello della chat può usare un servizio remoto. La porta del backend deve restare privata e DSH deve essere sulla stessa macchina. Il browser richiede localhost oppure HTTPS.

## Pubblicazione

Sono inclusi sorgenti, codice compilato, test, documentazione e attribuzioni, senza modelli, chiavi o sessioni personali. Prima di pubblicare scegli nome/scope npm e metadati del repository: il nome proposto non è riservato. Build, test e pubblicazione sono descritti nella [guida completa](README.md). Non è stato pubblicato nulla online.
