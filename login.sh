# http localhost:3000/auth/login email="admin@email.com" password="admin123" | jq -r ".token" > .auth_token
http localhost:5000/auth/login email="alice@email.com" password="password" | jq -r ".token" > .auth_token
# ./ask.sh "List all deals" 8000 admin false
# http --session daemoCRM \
#      localhost:5000/users \
#      "Authorization: Bearer $(< .auth_token)"

