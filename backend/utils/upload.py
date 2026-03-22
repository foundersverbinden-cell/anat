import os
import uuid
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_CONTENT_LENGTH = 2 * 1024 * 1024 # 2MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_valid_image(file_stream):
    header = file_stream.read(512)
    file_stream.seek(0)
    
    # Check JPEG magic bytes
    if header.startswith(b'\xff\xd8'):
        return True
    # Check PNG magic bytes
    if header.startswith(b'\x89PNG\r\n\x1a\n'):
        return True
    return False

def save_upload(file, upload_folder):
    if not file or not allowed_file(file.filename):
        return None
        
    if not is_valid_image(file.stream):
        return None
    
    file.seek(0, os.SEEK_END)
    size = file.tell()
    if size > MAX_CONTENT_LENGTH:
        return None
    file.seek(0)
    
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    filepath = os.path.join(upload_folder, unique_filename)
    file.save(filepath)
    return unique_filename
