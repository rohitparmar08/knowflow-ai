from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle


class AuthFlowTests(APITestCase):
    register_url = "/api/auth/register/"
    login_url = "/api/auth/login/"
    me_url = "/api/auth/me/"

    payload = {"username": "alice", "email": "alice@example.com", "password": "S3cretPass!"}

    def setUp(self):
        cache.clear()  # throttle counters live in the cache

    def test_register_creates_user_and_hides_password(self):
        res = self.client.post(self.register_url, self.payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["username"], "alice")
        self.assertNotIn("password", res.data)
        user = User.objects.get(username="alice")
        self.assertTrue(user.check_password("S3cretPass!"))  # stored hashed, not plain
        self.assertNotEqual(user.password, "S3cretPass!")

    def test_register_rejects_duplicate_username_and_email_case_insensitively(self):
        self.client.post(self.register_url, self.payload, format="json")
        dup_name = {**self.payload, "username": "ALICE", "email": "other@example.com"}
        dup_mail = {**self.payload, "username": "bob", "email": "ALICE@example.com"}
        self.assertEqual(self.client.post(self.register_url, dup_name, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.register_url, dup_mail, format="json").status_code, 400)

    def test_register_rejects_short_password_and_bad_email(self):
        short = {**self.payload, "password": "short"}
        bad_mail = {**self.payload, "email": "not-an-email"}
        self.assertEqual(self.client.post(self.register_url, short, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.register_url, bad_mail, format="json").status_code, 400)

    def test_login_returns_tokens_and_me_works_with_access_token(self):
        self.client.post(self.register_url, self.payload, format="json")
        res = self.client.post(
            self.login_url, {"username": "alice", "password": "S3cretPass!"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.client.get(self.me_url)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "alice@example.com")

    def test_login_with_wrong_password_is_rejected(self):
        self.client.post(self.register_url, self.payload, format="json")
        res = self.client.post(
            self.login_url, {"username": "alice", "password": "wrong"}, format="json"
        )
        self.assertEqual(res.status_code, 401)

    def test_refresh_token_issues_new_access_token(self):
        self.client.post(self.register_url, self.payload, format="json")
        login = self.client.post(
            self.login_url, {"username": "alice", "password": "S3cretPass!"}, format="json"
        )
        res = self.client.post("/api/auth/refresh/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get(self.me_url).status_code, 401)

    def test_health_endpoint_is_public(self):
        res = self.client.get("/api/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {"status": "ok"})

    def test_login_is_rate_limited(self):
        User.objects.create_user("alice", "alice@example.com", "S3cretPass!")
        bad = {"username": "alice", "password": "wrong"}
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"auth": "3/min"}):
            codes = [self.client.post(self.login_url, bad, format="json").status_code for _ in range(4)]
        self.assertEqual(codes, [401, 401, 401, 429])
