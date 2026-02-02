export const logEvent = async (
  client,
  eventType,
  performedBy,
  entity_type,
  entity_id,
  reason = null,
  metadata = null,
) => {
  await client.query(
    `
        INSERT INTO logs
        (event_type, performed_by, entity_type, entity_id, reason, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
    [eventType, performedBy, entity_type, entity_id, reason, metadata],
  );
};
