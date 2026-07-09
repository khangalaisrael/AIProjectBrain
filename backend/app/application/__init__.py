"""Application layer.

Use cases / services that orchestrate domain objects. Depends on the domain
layer only (via interfaces), never on infrastructure directly. Services such as
RepositoryService, EmbeddingService, CourseGenerator, and FlowGenerator live
here as they are implemented.
"""
