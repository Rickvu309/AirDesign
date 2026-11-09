import os, json, sqlite3, subprocess, time
from contextlib import closing
from pathlib import Path
from urllib.parse import quote

UID = os.getuid()

def git(*args, cwd=None):
    try:
        return subprocess.run(["git", "--no-optional-locks", *args], cwd=cwd, text=True, capture_output=True, timeout=60)
    except OSError as error:
        return subprocess.CompletedProcess(args, 1, "", str(error))

def under(path, root):
    return path == root or path.startswith(root + '/')
def inventory():
    result = git('worktree', 'list', '--porcelain')
    if result.returncode:
        raise RuntimeError('worktree-inventory-unavailable:' + result.stderr)
    rows = []
    for block in result.stdout.strip().split('\n\n'):
        fields = dict(line.split(' ', 1) if ' ' in line else (line, True) for line in block.splitlines())
        rows.append({'path':fields['worktree'], 'head':fields.get('HEAD'), 'branch':fields.get('branch'), 'metadata':fields})
    return rows, result.stdout

def active_bindings(database):
    if not database.is_file():
        raise RuntimeError('T3 safety database unavailable')
    with closing(sqlite3.connect('file:' + quote(str(database.resolve()), safe='/') + '?mode=ro', uri=True, timeout=1)) as db:
        db.execute('PRAGMA query_only=ON')
        active = {'preparing', 'queued', 'starting', 'running', 'waiting'}
        ids = {row[0] for row in db.execute('SELECT thread_id,status FROM orchestration_v2_projection_runs') if row[1] in active}
        ids.update(row[0] for row in db.execute("SELECT thread_id FROM orchestration_v2_projection_runtime_requests WHERE status='pending'"))
        return [json.loads(payload) for thread, payload in db.execute('SELECT thread_id,payload_json FROM orchestration_v2_projection_threads') if thread in ids]

def protections(row, bindings):
    path, head, branch = row['path'], row['head'] or '', (row['branch'] or '').removeprefix('refs/heads/')
    reasons = []
    names = {'owner-editor', 'owner-studio', 'owner-release', 'owner-reliability', 'owner-landing', 'owner-tools', 'engine-core-20261108', 't3-02d0cff4'}
    if Path(path).name in names or path == str(Path.home() / 'projects/airdesign'):
        reasons.append('protected-worktree')
    if any(under(path, str(Path.home() / 'tmp' / folder)) for folder in ['airdesign-polish', 'airdesign-engine']):
        reasons.append('protected-evidence')
    if any(head.startswith(pin) for pin in ['e30dfa4', 'b343343', 'fd8d2b7', '9c1e9c9', '822690d', '172b5d4', '55ad68c']):
        reasons.append('protected-pin')
    if branch in {'main', 'master'} or any(word in branch.lower() for word in ['safety', 'backup', 'baseline', 'hotfix/export-kill', 'engine/core-20261108']):
        reasons.append('protected-branch')
    for binding in bindings:
        bound = binding.get('worktreePath')
        if path and bound and (under(path, bound) or under(bound, path)) or branch and branch == binding.get('branch'):
            reasons.append('active-thread:' + binding.get('id', binding.get('threadId', 'unknown')))
    return reasons

def visibility_blocks(stats):
    blocked = []
    for pid in stats['quan_unreadable']:
        try:
            proc = Path('/proc') / str(pid)
            name = (proc / 'comm').read_text().strip()
            state = (proc / 'stat').read_text().split(') ', 1)[1].split()[0]
            if name not in {'systemd', '(sd-pam)', 'ssh-agent', 'gpg-agent'} and state != 'Z':
                blocked.append(pid)
        except FileNotFoundError:
            pass
    return blocked
def consumers(rows, symlinks=True, scan_root='/'):
    paths = [r['path'] for r in rows]
    hits = {p:[] for p in paths}
    stats = {'processes':0, 'other_uid_unreadable_cwd_fd':[], 'unreadable_cmdline':[], 'quan_unreadable':[], 'symlinks':0, 'directories':0, 'scan_errors':[]}
    def hit(target, evidence, source=None):
        target = target.removesuffix(' (deleted)')
        for root in paths:
            if under(target, root) and not (source and under(source, root)):
                if evidence not in hits[root]:
                    hits[root].append(evidence)
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        try:
            uid = proc.stat().st_uid
        except FileNotFoundError:
            continue
        stats['processes'] += 1
        try:
            command = (proc / 'cmdline').read_bytes()
            for root in paths:
                if root.encode() in command:
                    hits[root].append({'pid':int(proc.name), 'kind':'cmdline'})
        except PermissionError:
            stats['unreadable_cmdline'].append(int(proc.name))
        except (FileNotFoundError, ProcessLookupError):
            pass
        try:
            target = os.readlink(proc / 'cwd')
            if uid == UID:
                hit(target, {'pid':int(proc.name), 'kind':'cwd', 'target':target})
        except PermissionError:
            key = 'quan_unreadable' if uid == UID else 'other_uid_unreadable_cwd_fd'
            stats[key].append(int(proc.name))
        except (FileNotFoundError, ProcessLookupError):
            pass
        try:
            entries = list((proc / 'fd').iterdir())
            if uid == UID:
                for fd in entries:
                    try:
                        target = os.readlink(fd)
                        hit(target, {'pid':int(proc.name), 'kind':'fd', 'target':target})
                    except (FileNotFoundError, ProcessLookupError):
                        pass
        except PermissionError:
            key = 'quan_unreadable' if uid == UID else 'other_uid_unreadable_cwd_fd'
            if int(proc.name) not in stats[key]: stats[key].append(int(proc.name))
        except (FileNotFoundError, ProcessLookupError):
            pass
    if symlinks:
        deadline = time.monotonic() + 300
        stack = [scan_root]
        excluded = {'/proc','/sys','/dev'}
        while stack:
            if time.monotonic() > deadline:
                raise RuntimeError('global symlink audit deadline exceeded; no removal authorized')
            directory = stack.pop()
            try:
                with os.scandir(directory) as entries:
                    stats['directories'] += 1
                    for entry in entries:
                        try:
                            if entry.is_symlink():
                                stats['symlinks'] += 1
                                target = os.path.realpath(entry.path)
                                hit(target, {'kind':'symlink','source':entry.path,'target':target}, entry.path)
                            elif entry.is_dir(follow_symlinks=False) and entry.path not in excluded:
                                stack.append(entry.path)
                        except OSError as error:
                            stats['scan_errors'].append({'path':entry.path,'error':str(error)})
            except OSError as error:
                stats['scan_errors'].append({'path':directory,'error':str(error)})
    return hits, stats
