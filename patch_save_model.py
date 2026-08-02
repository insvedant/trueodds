path = "ml/models/train.py"
content = open(path).read()

# 1. Add a recursive numpy-to-native converter right after the imports,
#    if it isn't already there.
helper = '''
def _to_native(obj):
    """Recursively convert numpy scalar/array types to native Python types
    so pymongo's BSON encoder can serialize them. Without this, any numpy
    float32/int64/etc. anywhere in a metadata dict causes the MongoDB save
    to silently fail while the disk save (joblib, which handles numpy
    natively) succeeds -- exactly the CLV save_model warning we saw."""
    import numpy as np
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(v) for v in obj]
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

'''

marker = "def save_model(model, name: str, metadata: dict = None):"
if "_to_native" in content:
    print("SAFETY CHECK: _to_native helper already present -- not adding a duplicate.")
    helper_added = True
else:
    count = content.count(marker)
    if count != 1:
        print(f"SAFETY CHECK FAILED -- save_model marker found {count} times, expected 1. Aborting.")
        helper_added = False
    else:
        content = content.replace(marker, helper + marker, 1)
        helper_added = True
        print("Added _to_native helper.")

# 2. Sanitize metadata right before it's used in the Mongo document.
if helper_added:
    old_doc = '''            {
                "name":       name,
                "data":       buf.read(),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metadata":   metadata or {},
            },'''
    new_doc = '''            {
                "name":       name,
                "data":       buf.read(),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metadata":   _to_native(metadata or {}),
            },'''
    count2 = content.count(old_doc)
    if count2 != 1:
        print(f"SAFETY CHECK FAILED on the Mongo document block -- found {count2} matches, expected 1. Helper was added but metadata sanitization was NOT applied -- fix this block manually.")
    else:
        content = content.replace(old_doc, new_doc)
        print("Applied _to_native() to metadata before Mongo save.")
        open(path, "w").write(content)
        print("File written successfully.")
