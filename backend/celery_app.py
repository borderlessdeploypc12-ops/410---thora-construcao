"""Configuração Celery para fila persistente de Orçamento Analítico."""

from __future__ import annotations

from celery import Celery

from config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

celery_app = Celery(
    "thora_analitico",
    broker=CELERY_BROKER_URL or "memory://",
    backend=CELERY_RESULT_BACKEND or "cache+memory://",
    include=["tasks.analitico_tasks", "tasks.abc_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_concurrency=1,
    task_default_queue="analitico",
    task_routes={
        "analitico.process_full": {"queue": "analitico"},
        "abc.process_confirmed": {"queue": "abc"},
    },
)
