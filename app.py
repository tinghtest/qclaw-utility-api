"""
Simple Flask API for QR Code and Text Tools
Deploy to: PythonAnywhere (free tier)
"""
from flask import Flask, request, jsonify
import qrcode
import io
import base64

app = Flask(__name__)

@app.route('/')
def index():
    return jsonify({
        'status': 'ok',
        'service': 'QClaw Utility API (Python)',
        'version': '1.0.0',
        'endpoints': [
            'GET /qrcode?text=xxx&size=300',
            'GET /qrcode/png?text=xxx&size=300',
            'POST /text/analyze {"text":"..."}',
            'POST /text/transform {"text":"...","action":"..."}',
            'GET /url/encode?text=xxx',
            'GET /url/decode?text=xxx',
            'GET /base64/encode?text=xxx',
            'GET /base64/decode?text=xxx',
            'GET /random?type=uuid|password|number',
        ]
    })

@app.route('/qrcode')
def qrcode_base64():
    text = request.args.get('text', '')
    size = int(request.args.get('size', 300))
    color = request.args.get('color', '000000')
    bg = request.args.get('bg', 'ffffff')
    
    if not text:
        return jsonify({'error': 'text is required'}), 400
    
    img = qrcode.make(text, error_correction=qrcode.constants.ERROR_CORRECT_M)
    img = img.resize((size, size))
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return jsonify({
        'success': True,
        'text': text,
        'size': size,
        'data': f'data:image/png;base64,{img_str}'
    })

@app.route('/qrcode/png')
def qrcode_png():
    text = request.args.get('text', '')
    size = int(request.args.get('size', 300))
    
    if not text:
        return jsonify({'error': 'text is required'}), 400
    
    img = qrcode.make(text, error_correction=qrcode.constants.ERROR_CORRECT_M)
    img = img.resize((size, size))
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    
    from flask import make_response
    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'image/png'
    return response

@app.route('/text/analyze', methods=['POST'])
def text_analyze():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'text is required'}), 400
    
    text = data['text']
    chinese = [c for c in text if '\u4e00' <= c <= '\u9fff']
    words = text.strip().split()
    lines = text.split('\n')
    sentences = [s for s in text.replace('!','.').replace('?','.').split('.') if s.strip()]
    
    # Keyword extraction (simple n-gram)
    from collections import Counter
    import re
    tokens = re.findall(r'[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}', text)
    keywords = Counter(tokens).most_common(10)
    
    return jsonify({
        'success': True,
        'stats': {
            'chars': len(text),
            'words': len(words),
            'lines': len(lines),
            'sentences': len(sentences),
            'chineseChars': len(chinese),
            'englishWords': len([w for w in words if w.isascii()]),
            'readingMinutes': (len(text) + 499) // 500
        },
        'keywords': [{'word': w, 'count': c} for w, c in keywords]
    })

@app.route('/text/transform', methods=['POST'])
def text_transform():
    data = request.get_json()
    text = data.get('text', '')
    action = data.get('action', '')
    
    if not text or not action:
        return jsonify({'error': 'text and action are required'}), 400
    
    actions = {
        'uppercase': text.upper,
        'lowercase': text.lower,
        'trim': str.strip,
        'reverse': lambda s: s[::-1],
        'remove_blank_lines': lambda s: '\n'.join(line for line in s.split('\n') if line.strip()),
        'deduplicate_lines': lambda s: '\n'.join(dict.fromkeys(s.split('\n'))),
        'count_lines': lambda s: str(len([l for l in s.split('\n') if l.strip()])),
    }
    
    if action not in actions:
        return jsonify({'error': f'Unknown action: {action}'}), 400
    
    if action == 'count_lines':
        return jsonify({'success': True, 'action': action, 'count': len([l for l in text.split('\n') if l.strip()])})
    
    return jsonify({'success': True, 'action': action, 'result': actions[action](text)})

@app.route('/url/encode')
def url_encode():
    from urllib.parse import quote
    text = request.args.get('text', '')
    if not text:
        return jsonify({'error': 'text is required'}), 400
    return jsonify({'success': True, 'original': text, 'encoded': quote(text)})

@app.route('/url/decode')
def url_decode():
    from urllib.parse import unquote
    text = request.args.get('text', '')
    if not text:
        return jsonify({'error': 'text is required'}), 400
    try:
        return jsonify({'success': True, 'original': text, 'decoded': unquote(text)})
    except:
        return jsonify({'error': 'Invalid encoded string'}), 400

@app.route('/base64/encode')
def base64_encode():
    text = request.args.get('text', '')
    if not text:
        return jsonify({'error': 'text is required'}), 400
    return jsonify({'success': True, 'original': text, 'encoded': base64.b64encode(text.encode()).decode()})

@app.route('/base64/decode')
def base64_decode():
    text = request.args.get('text', '')
    if not text:
        return jsonify({'error': 'text is required'}), 400
    try:
        return jsonify({'success': True, 'original': text, 'decoded': base64.b64decode(text).decode()})
    except:
        return jsonify({'error': 'Invalid base64 string'}), 400

@app.route('/random')
def random_data():
    import uuid
    import random
    import string
    
    t = request.args.get('type', 'uuid')
    length = int(request.args.get('length', 16))
    
    if t == 'uuid':
        result = str(uuid.uuid4())
    elif t == 'password':
        chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
        result = ''.join(random.choice(chars) for _ in range(length))
    elif t == 'number':
        mn = int(request.args.get('min', 0))
        mx = int(request.args.get('max', 1000000))
        result = random.randint(mn, mx)
    else:
        return jsonify({'error': 'type must be uuid|password|number'}), 400
    
    return jsonify({'success': True, 'type': t, 'result': result})
