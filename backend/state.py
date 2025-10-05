# This global dictionary will hold the entire state of our exchange.
# It's simple and effective for a hackathon.

# The key is the user's Aeternity address (ak_...).
# The value is an Account object from our models.
ACCOUNTS_DB = {}

# Example structure:
# {
#   "ak_...user1": Account(
#     address="ak_...user1",
#     on_chain_balance_ae=1000.0,
#     available_collateral_ae=900.0,
#     positions=[Position(...)]
#   ),
#   "ak_...user2": Account(...)
# }
