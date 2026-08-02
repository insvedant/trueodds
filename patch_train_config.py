import re

path = "ml/models/train.py"
content = open(path).read()
lines = content.split('\n')

changed = []

for i, line in enumerate(lines):
    stripped = line.strip()
    if re.match(r'^MAX_SAMPLES\s*=\s*50_000\s*$', stripped):
        lines[i] = line.replace('50_000', '35_000')
        changed.append(('MAX_SAMPLES', i + 1))
    elif re.match(r'^N_JOBS\s*=\s*-1\s*$', stripped):
        indent = line[:len(line) - len(line.lstrip())]
        lines[i] = f'{indent}N_JOBS              = 1  # was -1 (all cores) -- reduced for memory safety on this VM'
        changed.append(('N_JOBS', i + 1))
    elif '(all cores)' in line and 'n_jobs' in line.lower():
        lines[i] = line.replace('(all cores)', '(single-threaded -- reduced for memory safety)')
        changed.append(('log line', i + 1))

if len(changed) < 2:
    print(f"SAFETY CHECK FAILED -- only matched {len(changed)} of the expected patterns: {changed}")
    print("Not writing any changes.")
else:
    open(path, 'w').write('\n'.join(lines))
    print(f"Patched successfully. Changed: {changed}")
