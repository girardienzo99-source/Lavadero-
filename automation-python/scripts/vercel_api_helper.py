#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Vercel API Helper Utility
Provides functions to interact with the Vercel REST API for the project:
Project ID: prj_c9aAuV3nOwfQ5zClvJ5iUpWwxN83

Requirements:
- requests package
- VERCEL_TOKEN environment variable (or passed as argument)

Usage:
  python vercel_api_helper.py --action info
  python vercel_api_helper.py --action deployments --limit 5
  python vercel_api_helper.py --action envs
  python vercel_api_helper.py --action create-env --key MY_VAR --value "my-value" --type secret
"""

import os
import sys
import json
import argparse
import requests

DEFAULT_PROJECT_ID = "prj_c9aAuV3nOwfQ5zClvJ5iUpWwxN83"
BASE_URL = "https://api.vercel.com"

class VercelAPIClient:
    def __init__(self, token=None, project_id=DEFAULT_PROJECT_ID, team_id=None):
        self.token = token or os.getenv("VERCEL_TOKEN")
        self.project_id = project_id
        self.team_id = team_id or os.getenv("VERCEL_TEAM_ID")
        
        if not self.token:
            print("Error: Vercel Token is required. Set VERCEL_TOKEN env variable or pass it to the client.", file=sys.stderr)
            sys.exit(1)
            
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def _get_params(self, extra_params=None):
        params = {}
        if self.team_id:
            params["teamId"] = self.team_id
        if extra_params:
            params.update(extra_params)
        return params

    def get_project_info(self):
        """Retrieves details of the project."""
        url = f"{BASE_URL}/v9/projects/{self.project_id}"
        response = requests.get(url, headers=self.headers, params=self._get_params())
        return response.status_code, response.json()

    def list_deployments(self, limit=10):
        """Lists deployments for the project."""
        url = f"{BASE_URL}/v6/deployments"
        params = self._get_params({"projectId": self.project_id, "limit": limit})
        response = requests.get(url, headers=self.headers, params=params)
        return response.status_code, response.json()

    def list_env_variables(self, decrypt=True):
        """Lists environment variables configured in the project."""
        url = f"{BASE_URL}/v9/projects/{self.project_id}/env"
        params = self._get_params({"decrypt": "true" if decrypt else "false"})
        response = requests.get(url, headers=self.headers, params=params)
        return response.status_code, response.json()

    def add_env_variable(self, key, value, env_type="plain", target=["development", "preview", "production"]):
        """
        Adds a new environment variable to the project.
        env_type can be: plain, encrypted, secret, sensitive
        target is a list containing any of: development, preview, production
        """
        url = f"{BASE_URL}/v10/projects/{self.project_id}/env"
        data = {
            "key": key,
            "value": value,
            "type": env_type,
            "target": target
        }
        response = requests.post(url, headers=self.headers, params=self._get_params(), json=data)
        return response.status_code, response.json()

    def delete_env_variable(self, env_id):
        """Deletes an environment variable by its ID."""
        url = f"{BASE_URL}/v9/projects/{self.project_id}/env/{env_id}"
        response = requests.delete(url, headers=self.headers, params=self._get_params())
        return response.status_code, response.json()


def main():
    parser = argparse.ArgumentParser(description="Vercel API Helper Utility for Project " + DEFAULT_PROJECT_ID)
    parser.add_argument("--action", required=True, choices=["info", "deployments", "envs", "create-env", "delete-env"],
                        help="Action to perform on Vercel API")
    parser.add_argument("--token", help="Vercel Access Token (overrides VERCEL_TOKEN env var)")
    parser.add_argument("--project", default=DEFAULT_PROJECT_ID, help="Vercel Project ID or name")
    parser.add_argument("--team", help="Vercel Team ID (optional)")
    parser.add_argument("--limit", type=int, default=10, help="Limit for list deployments (default: 10)")
    parser.add_argument("--key", help="Key name for environment variable")
    parser.add_argument("--value", help="Value for environment variable")
    parser.add_argument("--type", default="plain", choices=["plain", "encrypted", "secret", "sensitive"],
                        help="Type of environment variable (default: plain)")
    parser.add_argument("--env-id", help="ID of environment variable to delete")

    args = parser.parse_args()

    client = VercelAPIClient(token=args.token, project_id=args.project, team_id=args.team)

    print(f"Connecting to Vercel API for Project ID: {client.project_id}...")

    if args.action == "info":
        status_code, data = client.get_project_info()
        print(f"HTTP Status: {status_code}")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    elif args.action == "deployments":
        status_code, data = client.list_deployments(limit=args.limit)
        print(f"HTTP Status: {status_code}")
        if status_code == 200:
            deployments = data.get("deployments", [])
            print(f"Found {len(deployments)} deployments:")
            for dep in deployments:
                created = dep.get("created", "")
                url = dep.get("url", "")
                state = dep.get("state", "")
                print(f"- State: {state} | Created: {created} | URL: https://{url}")
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))

    elif args.action == "envs":
        status_code, data = client.list_env_variables()
        print(f"HTTP Status: {status_code}")
        if status_code == 200:
            envs = data.get("envs", [])
            print(f"Found {len(envs)} environment variables:")
            for env in envs:
                print(f"- ID: {env.get('id')} | Key: {env.get('key')} | Type: {env.get('type')} | Targets: {env.get('target', [])}")
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))

    elif args.action == "create-env":
        if not args.key or not args.value:
            parser.error("--key and --value are required for create-env action")
        status_code, data = client.add_env_variable(args.key, args.value, args.type)
        print(f"HTTP Status: {status_code}")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    elif args.action == "delete-env":
        if not args.env_id:
            parser.error("--env-id is required for delete-env action")
        status_code, data = client.delete_env_variable(args.env_id)
        print(f"HTTP Status: {status_code}")
        print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
