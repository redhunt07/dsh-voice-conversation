# DSH Voice Conversation — guida italiana

[![npm version](https://img.shields.io/npm/v/dsh-voice-conversation.svg)](https://www.npmjs.com/package/dsh-voice-conversation) [![DSH Hub: submitted](https://img.shields.io/badge/DSH_Hub-submitted-64748b.svg)](https://github.com/dshplugin/dsh-plugin-hub/issues/548) [![Plugin tests](https://github.com/redhunt07/dsh-voice-conversation/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/redhunt07/dsh-voice-conversation/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/github/license/redhunt07/dsh-voice-conversation.svg)](LICENSE) [![GitHub Packages](https://img.shields.io/badge/GitHub-Packages-181717?logo=github)](https://github.com/users/redhunt07/packages/npm/package/dsh-voice-conversation)

Maintainer / autore del fork: **[RedHunt07](https://github.com/redhunt07)** · License: **MIT**. Original Voice Loop code by ZG2017; see [NOTICE.md](NOTICE.md).
Conversazione vocale continua italiano/inglese: parli, fai una pausa di 1,7 secondi e il prompt viene inviato. Dopo la risposta vocale torna in ascolto. La barra compatta lascia visibili chat, strumenti e Think reso disponibile da DSH.

Versione iniziale **0.1.1**, verificata con **DSH 0.2.0-rc.2**, Node.js 22+ e Linux. I test automatici simulano il microfono: prima di una release stabile serve una prova prolungata in ambienti reali.

## Installazione

Pacchetto npm: **[dsh-voice-conversation](https://www.npmjs.com/package/dsh-voice-conversation)**. La versione attualmente pubblicata su npm è **0.1.1**:

```sh
dsh plugin --profile web add dsh-voice-conversation
```

Per fissare la versione verificata:

```sh
dsh plugin --profile web add dsh-voice-conversation@0.1.1
```

La stessa versione **0.1.1** è disponibile anche come archivio precompilato su GitHub:

```sh
dsh plugin --profile web add https://raw.githubusercontent.com/redhunt07/dsh-voice-conversation/main/dist/dsh-voice-conversation-0.1.1.tgz
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

Sono inclusi sorgenti, codice compilato, test, documentazione e attribuzioni, senza modelli, chiavi o sessioni personali. Il progetto è pubblico su GitHub e il pacchetto è disponibile su npm; le versioni disponibili nei due canali sono indicate sopra. Build, test e pubblicazione sono descritti nella [guida completa](README.md).

## Correzioni e voci italiane locali (0.1.1)

Sono corretti i casi di risposta finale in ritardo, ripresa nello stesso turno dopo un'approvazione, invio che non parte ed eventi audio residui che interrompono la risposta successiva. Anche il selettore alternativo ora riconosce l'italiano.

Per usare Kokoro: `python3 scripts/runtime.py setup --device cuda --tts kokoro`, oppure `--device cpu`. Poi avvia normalmente. Setup scarica circa 354 MB aggiuntivi e ne verifica gli hash. Puoi scegliere `if_sara` (Sara) o `im_nicola` (Nicola) per l'italiano; `af_heart` per inglese. Con Kokoro attivo, le vecchie selezioni Paola/Lessac vengono associate a Sara/Heart. Sono rispettate pause tra frasi e proposizioni, e il Markdown viene pulito solo per la lettura. Piper resta disponibile. La naturalezza va valutata ascoltando: non è garantita la stessa qualità di un servizio vocale realtime commerciale.

## Pacchetto nella sezione Packages di GitHub

È pubblico e collegato al repository: **[@redhunt07/dsh-voice-conversation 0.1.1](https://github.com/users/redhunt07/packages/npm/package/dsh-voice-conversation)**. [Istruzioni per il registro GitHub](docs/github-packages.md). Usa una sola distribuzione del plugin per profilo: npm oppure GitHub Packages.

## Inserimento nel Plugin Hub

La scansione del catalogo è seguita nella [issue #548](https://github.com/dshplugin/dsh-plugin-hub/issues/548). Il badge indica la presentazione della richiesta; l’installazione npm funziona anche mentre si attende l’inserimento. Il repository è pubblico, ha il topic GitHub `dsh-plugin`, contiene `package.json` nella radice ed esporta `apply` dal modulo `lib/index.js`; l’implementazione è in [src/index.ts](src/index.ts).

### Candidato 0.1.2: metadati e discovery

Il pacchetto preparato aggiunge le keyword npm `dsh-plugin` / `deepseek-harness` e dichiara direttamente `export function apply(ctx, config)` nel file generato dal build, come gli esempi già listati. La funzione resta identica. È una precauzione per gli scanner statici: il codice dello scanner del catalogo non è pubblico e la causa dell’esclusione non è confermata. La pubblicazione npm attende l’autenticazione del maintainer; la versione pubblicata resta 0.1.1.
