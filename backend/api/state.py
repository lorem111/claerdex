# Vercel KV-based state management for serverless deployment
# This replaces the in-memory dictionary with a Redis-backed KV store

import os
import json

# Import Redis for Vercel KV
try:
    import redis
    # Vercel KV uses REDIS_URL environment variable
    REDIS_URL = os.environ.get("REDIS_URL")

    if REDIS_URL:
        # Connect to Vercel KV via Redis URL
        kv = redis.from_url(
            REDIS_URL,
            decode_responses=True
        )
        # Test connection
        kv.ping()
        USING_KV = True
        print("[STATE KV] ✓ Vercel KV connected successfully")
    else:
        USING_KV = False
        kv = None
        ACCOUNTS_DB = {}
        print("[STATE KV] ✗ REDIS_URL not found, using in-memory storage")
except Exception as e:
    USING_KV = False
    kv = None
    ACCOUNTS_DB = {}
    print(f"[STATE KV] ✗ Failed to connect to Vercel KV: {e}, using in-memory storage")

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
            print(f"[STATE] ✗ Error saving account to KV: {e}")
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
