from app.admin_bootstrap import create_admin_if_missing


def seed_admin():
    return create_admin_if_missing()


if __name__ == "__main__":
    seed_admin()