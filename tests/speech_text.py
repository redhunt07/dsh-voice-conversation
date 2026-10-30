import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('speech_text', Path(__file__).resolve().parents[1] / 'runtime/speech_text.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
normalize = module.normalize_for_speech
class SpeechTextTests(unittest.TestCase):
    def test_italian_pauses(self):
        self.assertEqual(normalize('Aspetta… davvero?\nSì, certo!'), 'Aspetta... davvero? Sì, certo!')
    def test_markdown(self):
        self.assertEqual(normalize('## Ecco il risultato\n- **Prima voce**\n- Leggi [la guida](https://example.com).'), 'Ecco il risultato. Prima voce. Leggi la guida.')
    def test_code_is_not_spelled(self):
        self.assertEqual(normalize('```python\nprint("segreto")\n```'), 'Il codice è nella chat.')
    def test_english_notice(self):
        self.assertEqual(normalize('```sh\necho hello\n```', 'en'), 'The code is in the chat.')
if __name__ == '__main__':
    unittest.main()
