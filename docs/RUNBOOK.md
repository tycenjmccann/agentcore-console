# Operational Runbook: Model Selector Feature

## Overview

Operational procedures for monitoring, troubleshooting, and managing the per-invocation model selector feature.

**Target Audience:** DevOps, SRE, Operations Team

---

## Quick Reference

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | #oncall-engineering | Manager |
| Platform Team | #platform-team | Tech Lead |

### Critical Links

- Dashboard: AWS CloudWatch
- Logs: CloudWatch Logs
- Alarms: CloudWatch Alarms
- Status Page: https://status.yourcompany.com

---

## Monitoring

### Key Metrics

- ModelSelectionCount
- ModelValidationErrors
- ModelFallbackCount
- ModelInvocationDuration

### Alarms

- High validation error rate (>5%)
- High fallback rate (>10%)
- Slow performance (p99 > 30s)

---

## Common Issues

### Issue 1: Model Unavailable

**Diagnosis:**
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/agentcore-workflow-engine \
  --filter-pattern '"Model.*unavailable"'
```

**Resolution:**
- Check provider status
- Disable model if needed
- System auto-fallbacks to default

### Issue 2: High Validation Error Rate

**Diagnosis:** Check recent validation errors in logs

**Resolution:**
- Check for UI/API deployment issues
- Verify model IDs
- Rollback if needed

### Issue 3: Performance Degradation

**Diagnosis:** Check API latency metrics

**Resolution:**
- Clear CDN cache
- Check rate limits
- Scale resources

### Issue 4: Cost Spike

**Diagnosis:** Review model usage by provider

**Resolution:**
- Identify expensive models
- Set usage limits
- Communicate with users

---

## Procedures

### Disable Model

1. Update models list in code
2. Deploy changes
3. Clear CDN cache
4. Notify users
5. Monitor

### Re-enable Model

1. Verify provider status
2. Uncomment model
3. Deploy and verify
4. Notify users

### Monitor Model Usage

Daily usage reports with cost estimates

### Check Provider Status

Automated status checks for all 3 providers

---

## Maintenance

### Weekly Tasks
- Review model usage report
- Check for validation errors
- Review cost trends

### Monthly Tasks
- Review and update model list
- Audit usage patterns
- Optimize costs

### Quarterly Tasks
- Review provider contracts
- Evaluate new providers
- Conduct DR drill

---

## Disaster Recovery

Procedures for handling complete provider outages

---

Last Updated: 2025-01-13
Maintained By: Platform Team
Review Frequency: Monthly
