# Vercel KV-based state management for serverless deployment
# This replaces the in-memory dictionary with a Redis-backed KV store

import os
import json

# Import will work when deployed to Vercel with KV configured
try:
    from vercel_kv import kv
    USING_KV = True
except ImportError:
    # Fallback to in-memory for local development
    print("Warning: vercel_kv not available, using in-memory storage for local dev")
    USING_KV = False
    ACCOUNTS_DB = {}

from models import Account

def get_account(address: str) -> Account | None:
    """Fetches an account from Vercel KV or local memory."""
    if USING_KV:
        try:
            account_json = kv.get(address)
            if account_json:
                # Parse JSON string back into Account model
                if isinstance(account_json, str):
                    return Account.model_validate_json(account_json)
                else:
                    # If it's already a dict
                    return Account.model_validate(account_json)
        except Exception as e:
            print(f"Error fetching account from KV: {e}")
            return None
    else:
        # Local development fallback
        return ACCOUNTS_DB.get(address)

    return None

def save_account(account: Account) -> bool:
    """Saves an account to Vercel KV or local memory."""
    if USING_KV:
        try:
            # Convert account to JSON string for storage
            account_json = account.model_dump_json()
            kv.set(account.address, account_json)
            return True
        except Exception as e:
            print(f"Error saving account to KV: {e}")
            return False
    else:
        # Local development fallback
        ACCOUNTS_DB[account.address] = account
        return True

def delete_account(address: str) -> bool:
    """Deletes an account from Vercel KV or local memory."""
    if USING_KV:
        try:
            kv.delete(address)
            return True
        except Exception as e:
            print(f"Error deleting account from KV: {e}")
            return False
    else:
        # Local development fallback
        if address in ACCOUNTS_DB:
            del ACCOUNTS_DB[address]
            return True
        return False
