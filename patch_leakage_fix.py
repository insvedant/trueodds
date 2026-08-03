import re

path = "ml/models/train.py"
content = open(path).read()

changes = []

# --- FIX 1: EV Confidence feature leakage ---
old_ev_block = '''X_rows.append({
                    "ev_pct":          ev_pct,
                    "pin_prob":        pin_prob,
                    "book_dec":        book_dec,
                    "sharp_agreement": float(abs(avg_other - pin_prob)),
                    "n_books":         len(books),
                    "high_ev":         int(ev_pct >= 5.0),
                })'''
new_ev_block = '''X_rows.append({
                    "pin_prob":        pin_prob,
                    "book_dec":        book_dec,
                })'''
count_ev = content.count(old_ev_block)
if count_ev == 1:
    content = content.replace(old_ev_block, new_ev_block)
    changes.append("EV confidence feature leakage fix")
else:
    print(f"EV FIX SAFETY CHECK: found {count_ev} matches (expected 1) -- skipping, file may have drifted")

# --- FIX 2: Sharp Money AUC=0 from unstratified split ---
# Target specifically the function body of train_sharp_money_model by
# anchoring on its unique preceding line (build_sharp_money_dataset call),
# not just the generic train_test_split line shared by other models.
pattern = re.compile(
    r'(result = build_sharp_money_dataset\(db\)\s*\n\s*if not result:\s*\n\s*return \{"success": False, "reason": "insufficient_data"\}\s*\n\s*\n\s*X, y = result\s*\n)(\s*)X_train, X_test, y_train, y_test = train_test_split\(X, y, test_size=0\.2, random_state=RANDOM_STATE\)\n'
)

def repl(m):
    prefix, indent = m.group(1), m.group(2)
    new_code = (
        f"{indent}try:\n"
        f"{indent}    X_train, X_test, y_train, y_test = train_test_split(\n"
        f"{indent}        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y)\n"
        f"{indent}except ValueError as e:\n"
        f'{indent}    logger.warning(f"Sharp money: stratified split failed ({{e}}), falling back to plain split")\n'
        f"{indent}    X_train, X_test, y_train, y_test = train_test_split(\n"
        f"{indent}        X, y, test_size=0.2, random_state=RANDOM_STATE)\n"
    )
    return prefix + new_code

new_content, n_subs = pattern.subn(repl, content)
if n_subs == 1:
    content = new_content
    changes.append("Sharp money stratified split fix")
else:
    print(f"SPLIT FIX SAFETY CHECK: anchored pattern matched {n_subs} times (expected 1) -- file structure may have drifted. Skipping this fix -- send updated file content if this happens.")

if changes:
    open(path, "w").write(content)
    print(f"Applied: {changes}")
else:
    print("No changes applied.")
