"""Readable speech text; keep the original answer unchanged in DSH chat."""
import re

def normalize_for_speech(text: str, language: str = 'it') -> str:
    code_notice = 'Il codice è nella chat.' if language == 'it' else 'The code is in the chat.'
    text = re.sub(r'```[^\n]*\n?[\s\S]*?```', code_notice, text)
    text = re.sub(r'!?\[([^\]]+)\]\([^\s)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', 'link', text)
    text = re.sub(r'(?m)^\s{0,3}#{1,6}\s+', '', text)
    text = re.sub(r'(?m)^\s*(?:[-*+] |\d+[.)] )', '', text)
    text = re.sub(r'(?m)^\s*>\s?', '', text)
    text = text.replace('**', '').replace('__', '').replace('`', '').replace('…', '...')
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.splitlines()]
    # Paragraphs and list items need a spoken boundary, not a run-on sentence.
    return ' '.join(line if re.search(r'[.!?:;,]$', line) else line + '.' for line in lines if line).strip()
