# ADR-005: React Flow (`@xyflow/react`) for the node canvas

**Status**: accepted (2026-09-05)

Building pan/zoom/selection/edge routing from scratch is not product value.
React Flow is MIT, framework-native, supports custom nodes/handles, connection
validation, minimap, and keyboard handling. Node bodies, panels and palette are
our Bootstrap components; the persisted format is our `WorkflowDocument`, not
React Flow's state (positions are copied in/out).
