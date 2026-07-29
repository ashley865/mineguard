import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buttonPrimary, inputClass, labelClass } from "../components/ui";

export default function Signup() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.[0] ?? err.response?.data?.error ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mine-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold">⛏ Mine Guard</div>
          <div className="text-mine-300 text-sm mt-1">Create your account</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-mine-900 border border-mine-800 rounded-lg p-6 space-y-4">
          <div>
            <label className={labelClass}>Full name</label>
            <input
              className={inputClass}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="text-xs text-mine-400 mt-1">At least 8 characters.</div>
          </div>
          {error && <div className="text-danger-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${buttonPrimary} w-full`}>
            {loading ? "Creating account…" : "Create account"}
          </button>
          <div className="text-xs text-mine-400 pt-2 border-t border-mine-800 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-mine-300 underline hover:text-mine-100">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
