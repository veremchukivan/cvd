from django.core.management.base import CommandError


def queue_task(*, task, label: str, stdout, style, args: tuple = (), kwargs: dict | None = None) -> str:
    try:
        async_result = task.apply_async(args=args, kwargs=kwargs or {})
    except Exception as exc:
        raise CommandError(f"Unable to queue {label}: {exc}") from exc

    stdout.write(style.SUCCESS(f"Queued {label} via Celery worker (task_id={async_result.id})"))
    return async_result.id
