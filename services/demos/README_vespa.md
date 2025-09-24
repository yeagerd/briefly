# Vespa Demo Services

This directory contains comprehensive demonstration services for the Vespa-powered hybrid search system. These demos showcase end-to-end functionality including data ingestion, indexing, search capabilities, and chat integration.

## 🚀 Quick Demo Flow

**Complete end-to-end demo in 6 steps:**

```bash
# 1. Start foundation services
colima start
./scripts/pubsub-manager.sh
./scripts/vespa.sh
./scripts/postgres-start.sh

# 2. Setup database
./install.sh
source .venv/bin/activate
./scripts/run-migration.sh
./install.sh

# 3. Start Briefly services with human-readable logging
./scripts/start-dev-logs.sh

# 4. Clear existing data from Vespa
EMAIL=trybriefly@outlook.com
./scripts/vespa.sh --clear-data --email ${EMAIL} --env-file .env.local --force

# 5. Backfill with fresh data
python services/demos/vespa_backfill.py ${EMAIL}

# 6. Search and dump results
python services/demos/vespa_search.py ${EMAIL} --dump
```


## Troubleshooting

### Common Issues

1. **Vespa connection failed**:
   - Check if Vespa container is running
   - Verify endpoint URL and port
   - Check Vespa application status

2. **Pub/Sub publishing failed**:
   - Verify emulator is running: `./scripts/pubsub-manager.sh status`
   - Check topic creation: Should see 3 topics listed
   - Verify message format and project ID
   - Restart emulator if needed: `./scripts/pubsub-manager.sh --restart`

3. **Pub/Sub emulator issues**:
   - **"Could not list topics/subscriptions"**: Script now uses REST API instead of gcloud
   - **Authentication errors**: Not needed for local emulator
   - **Port conflicts**: Check if port 8085 is available
   - **Container issues**: Use `./scripts/pubsub-manager.sh cleanup` then restart

4. **Search returns no results**:
   - Check if data was indexed
   - Verify user_id filtering
   - Check query syntax

5. **Performance degradation**:
   - Monitor Vespa resource usage
   - Check query complexity
   - Verify index optimization
