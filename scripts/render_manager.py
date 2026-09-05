#!/usr/bin/env python3
"""
Render Management Utility for Sanjivani.
Allows inspecting service status, triggering deploys, checking deploy logs/history,
and managing environment variables directly via Render API.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Load .env if present
def load_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

RENDER_API_KEY = os.getenv("RENDER_API_KEY")
RENDER_SERVICE_ID = os.getenv("RENDER_SERVICE_ID", "srv-dae6j6tbedkc73bhg7sg")
BASE_URL = "https://api.render.com/v1"

def api_request(endpoint: str, method: str = "GET", data: dict = None):
    if not RENDER_API_KEY:
        print("[ERROR] RENDER_API_KEY is not set in environment or .env file.", file=sys.stderr)
        sys.exit(1)

    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            if content:
                return json.loads(content)
            return {}
    except HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[HTTP Error {e.code}] {e.reason}: {err_msg}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"[Network Error] {e.reason}", file=sys.stderr)
        sys.exit(1)

def cmd_status(args):
    service = api_request(f"/services/{RENDER_SERVICE_ID}")
    print(f"Service Name:    {service.get('name')}")
    print(f"Service ID:      {service.get('id')}")
    print(f"Slug:            {service.get('slug')}")
    print(f"Status:          {service.get('suspended', 'active')}")
    print(f"URL:             {service.get('serviceDetails', {}).get('url')}")
    print(f"Branch:          {service.get('branch')}")
    print(f"Repo:            {service.get('repo')}")
    print(f"Dashboard:       {service.get('dashboardUrl')}")
    print(f"Updated At:      {service.get('updatedAt')}")

def cmd_deploys(args):
    limit = args.limit or 5
    deploys = api_request(f"/services/{RENDER_SERVICE_ID}/deploys?limit={limit}")
    print(f"{'Deploy ID':<26} {'Status':<15} {'Commit':<10} {'Created At'}")
    print("-" * 75)
    for d in deploys:
        deploy = d.get("deploy", {})
        dep_id = deploy.get("id", "")
        status = deploy.get("status", "")
        commit = deploy.get("commit", {}).get("id", "")[:7] if deploy.get("commit") else "N/A"
        created = deploy.get("createdAt", "")
        print(f"{dep_id:<26} {status:<15} {commit:<10} {created}")

def cmd_deploy(args):
    clear_cache = "clear" if args.clear_cache else "do_not_clear"
    payload = {"clearCache": clear_cache}
    res = api_request(f"/services/{RENDER_SERVICE_ID}/deploys", method="POST", data=payload)
    print(f"[OK] Triggered deployment: {res.get('id')}")
    print(f"Status: {res.get('status')}")

def cmd_restart(args):
    res = api_request(f"/services/{RENDER_SERVICE_ID}/restart", method="POST")
    print(f"[OK] Service restart requested for {RENDER_SERVICE_ID}")

def cmd_env_list(args):
    env_vars = api_request(f"/services/{RENDER_SERVICE_ID}/env-vars")
    print(f"{'Key':<30} {'Value'}")
    print("-" * 60)
    for item in env_vars:
        ev = item.get("envVar", {})
        k = ev.get("key", "")
        v = ev.get("value", "")
        if "KEY" in k or "SECRET" in k or "PASSWORD" in k:
            masked_v = v[:4] + "..." + v[-4:] if len(v) > 8 else "***"
        else:
            masked_v = v
        print(f"{k:<30} {masked_v}")

def cmd_env_set(args):
    key, val = args.key_value.split("=", 1)
    existing = api_request(f"/services/{RENDER_SERVICE_ID}/env-vars")
    vars_list = []
    found = False
    for item in existing:
        k = item.get("envVar", {}).get("key")
        v = item.get("envVar", {}).get("value")
        if k == key:
            vars_list.append({"key": key, "value": val})
            found = True
        else:
            vars_list.append({"key": k, "value": v})
    if not found:
        vars_list.append({"key": key, "value": val})

    res = api_request(f"/services/{RENDER_SERVICE_ID}/env-vars", method="PUT", data=vars_list)
    print(f"[OK] Updated environment variable: {key}")

def main():
    parser = argparse.ArgumentParser(description="Render Management CLI for Sanjivani")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = subparsers.add_parser("status", help="Get service status and details")
    p_status.set_defaults(func=cmd_status)

    # deploys
    p_deploys = subparsers.add_parser("deploys", help="List recent deployments")
    p_deploys.add_argument("--limit", type=int, default=5, help="Number of deployments to show")
    p_deploys.set_defaults(func=cmd_deploys)

    # deploy
    p_deploy = subparsers.add_parser("deploy", help="Trigger a new deployment")
    p_deploy.add_argument("--clear-cache", action="store_true", help="Clear build cache before deploy")
    p_deploy.set_defaults(func=cmd_deploy)

    # restart
    p_restart = subparsers.add_parser("restart", help="Restart the service")
    p_restart.set_defaults(func=cmd_restart)

    # env-list
    p_env_list = subparsers.add_parser("env-list", help="List environment variables")
    p_env_list.set_defaults(func=cmd_env_list)

    # env-set
    p_env_set = subparsers.add_parser("env-set", help="Set or update an environment variable (KEY=VALUE)")
    p_env_set.add_argument("key_value", help="KEY=VALUE format")
    p_env_set.set_defaults(func=cmd_env_set)

    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
