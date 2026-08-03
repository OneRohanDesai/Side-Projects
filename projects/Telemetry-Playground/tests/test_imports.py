def test_import_generator():
    import app.generator.main as generator

    assert generator.app is not None
    assert generator.GENERATOR_NAME


def test_import_receiver():
    import app.receiver.main as receiver

    assert receiver.app is not None


def test_import_dashboard():
    import app.dashboard.main as dashboard

    assert dashboard.app is not None
