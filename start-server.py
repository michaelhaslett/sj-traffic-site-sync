"""
Quick launcher for the SJ Traffic Site Checklist PWA.
Double-click this file (or run: python start-server.py) to start
a local web server and open the app in your browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000

# Change to the directory where this script lives
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Serves files with correct MIME types and suppresses noisy logs."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.html': 'text/html',
        '.woff2': 'font/woff2',
    }

    def log_message(self, format, *args):
        # Only log errors, not every request
        if args and '404' in str(args):
            super().log_message(format, *args)

    def end_headers(self):
        # Add headers for Service Worker and caching
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()


def main():
    # Allow socket reuse BEFORE binding
    socketserver.TCPServer.allow_reuse_address = True

    try:
        httpd = socketserver.TCPServer(("", PORT), QuietHandler)
    except OSError as e:
        print(f"\n  ERROR: Could not start server on port {PORT}.")
        print(f"  {e}")
        print(f"\n  Try closing other programs using port {PORT}, or change PORT in this file.")
        input("\n  Press Enter to exit...")
        sys.exit(1)

    print(f"""
  =============================================
    SJ Traffic  -  Site Checklist PWA
    Local Development Server
  ---------------------------------------------
    URL:  http://localhost:{PORT}
    Press Ctrl+C to stop
  =============================================
    """)

    webbrowser.open(f"http://localhost:{PORT}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n  Unexpected error: {e}")
        input("\n  Press Enter to exit...")
