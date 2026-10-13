import sys, os, io, csv, json, time, threading, urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8080
DIRECTORY = r"c:\Users\adity\.gemini\antigravity-ide\brain\1st"
BACKUP_DIR = r"C:\Users\adity\.gemini\antigravity-ide\brain\4bb3d908-a620-4258-a984-751fdfb4e9bc\backup"
SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE/gviz/tq?tqx=out:csv&sheet=LEDGER"

latest_records = []
last_sync_timestamp = 0
last_sync_status = "Initialized"

def clean_num(val):
    if not val: return 0.0
    val_clean = str(val).replace(',', '').replace('₹', '').replace('Rs.', '').replace(' ', '').strip()
    try: return float(val_clean)
    except: return 0.0

def fetch_live_ledger():
    global latest_records, last_sync_timestamp, last_sync_status
    try:
        req = urllib.request.Request(SHEET_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode('utf-8')
        
        reader = list(csv.reader(io.StringIO(content)))
        if not reader or len(reader) <= 1:
            return False, "Empty sheet response"
        
        rows = reader[1:]
        parsed = []
        for idx, r in enumerate(rows):
            if not any(r): continue
            date = r[0].strip() if len(r) > 0 else ''
            by = r[1].strip() if len(r) > 1 else 'Honey'
            for_entity = r[2].strip() if len(r) > 2 else 'Home'
            item = r[3].strip() if len(r) > 3 else ''
            exp_acc = r[4].strip() if len(r) > 4 else 'Hom Cash'
            cat = r[5].strip() if len(r) > 5 else 'misc expn'
            amt_exp = clean_num(r[6] if len(r) > 6 else 0)
            bal = clean_num(r[7] if len(r) > 7 else 0)
            info = r[8].strip() if len(r) > 8 else ''
            amt_in = clean_num(r[9] if len(r) > 9 else 0)
            inc_acc = r[10].strip() if len(r) > 10 else ''
            month = r[12].strip() if len(r) > 12 else ''
            
            if date or item or amt_exp or amt_in:
                parsed.append({
                    'row': idx + 2,
                    'date': date,
                    'by': by or 'Honey',
                    'for': for_entity or 'Home',
                    'item': item,
                    'exp_acc': exp_acc or 'Hom Cash',
                    'cat': cat or 'misc expn',
                    'amt_exp': amt_exp,
                    'bal': bal,
                    'info': info,
                    'amt_in': amt_in,
                    'inc_acc': inc_acc,
                    'month': month
                })
        
        if len(parsed) > 0:
            latest_records = parsed
            last_sync_timestamp = time.time()
            last_sync_status = f"Synced {len(parsed)} rows at {time.strftime('%H:%M:%S')}"
            
            # Update local files
            js_content = f"window.LEDGER_DATA = {json.dumps(parsed)};\n"
            try:
                with open(os.path.join(DIRECTORY, "ledger-data.js"), "w", encoding="utf-8") as f:
                    f.write(js_content)
                with open(os.path.join(BACKUP_DIR, "mobile_dashboard_code", "ledger-data.js"), "w", encoding="utf-8") as f:
                    f.write(js_content)
                with open(os.path.join(BACKUP_DIR, "transactions_ledger.json"), "w", encoding="utf-8") as f:
                    json.dump(parsed, f, indent=2)
            except Exception as e:
                print(f"[Sync Error writing cache]: {e}")
            
            print(f"[Live Sync]: {last_sync_status}")
            return True, last_sync_status
    except Exception as e:
        last_sync_status = f"Error: {e}"
        print(f"[Sync Error]: {e}")
        return False, str(e)

# Background auto-sync thread (every 25 seconds)
def background_sync_worker():
    while True:
        try:
            fetch_live_ledger()
        except Exception as e:
            print(f"[Background Sync Exception]: {e}")
        time.sleep(25)

class SyncHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path in ['/api/sync', '/api/data']:
            success, msg = fetch_live_ledger()
            data = {
                'status': 'success' if success else 'cached',
                'message': msg,
                'count': len(latest_records),
                'timestamp': last_sync_timestamp,
                'formatted_time': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_sync_timestamp)) if last_sync_timestamp else '',
                'records': latest_records
            }
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        elif self.path == '/api/status':
            data = {
                'status': last_sync_status,
                'timestamp': last_sync_timestamp,
                'count': len(latest_records)
            }
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
            return
        
        return super().do_GET()

if __name__ == '__main__':
    print(f"Starting Live Sync Server on port {PORT}...")
    fetch_live_ledger()
    
    t = threading.Thread(target=background_sync_worker, daemon=True)
    t.start()
    
    server = HTTPServer(('0.0.0.0', PORT), SyncHTTPHandler)
    print(f"Server serving at http://0.0.0.0:{PORT} from {DIRECTORY}")
    server.serve_forever()
