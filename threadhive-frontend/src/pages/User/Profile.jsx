import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Card, Row, Col, Form, Button, Nav, Spinner } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { setUser } from "../../reducers/authSlice";
import { fetchBookmarksThunk } from "../../reducers/bookmarkSlice";
import ThreadList from "../../components/ThreadList/ThreadList";
import "./Profile.css";

// Stable empty reference so the selector doesn't return a new array each render.
const EMPTY_THREADS = [];

function Profile() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user) ?? {};
  const savedThreads = useSelector(
    (state) => state.bookmarks?.savedThreads ?? EMPTY_THREADS
  );
  const bookmarksLoading = useSelector(
    (state) => state.bookmarks?.loading ?? false
  );
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name ?? "",
    email: user.email ?? "",
    bio: user.bio ?? "",
    location: user.location ?? "",
    website: user.website ?? "",
  });

  // Load the user's saved threads so the Bookmarks tab is ready.
  useEffect(() => {
    dispatch(fetchBookmarksThunk());
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    dispatch(setUser(form));
    setEditing(false);
  };

  return (
    <Container className="mt-3 mb-4">
      <Button variant="link" className="profile-back-btn p-0" onClick={() => navigate('/home')}>
        ← Back to Home
      </Button>

      <Nav
        variant="tabs"
        className="mb-3 mt-2"
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key)}
      >
        <Nav.Item>
          <Nav.Link eventKey="profile">👤 Profile</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="bookmarks">🔖 Bookmarks</Nav.Link>
        </Nav.Item>
      </Nav>

      {activeTab === "profile" && (
      <Card className="profile-card border-0 shadow-sm">
        <Card.Body className="profile-header">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {form.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
          <div className="profile-info-section">
            <div className="profile-title-row">
              <h2 className="profile-name">{form.name ?? "User"}</h2>
              <div>
                {editing ? (
                  <>
                    <Button variant="success" size="sm" className="me-2" onClick={handleSave}>
                      ✓ Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                      ✕ Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                    ✏️ Edit Profile
                  </Button>
                )}
              </div>
            </div>

            {!editing ? (
              <div className="profile-fields">
                <div className="profile-field">
                  <div className="profile-field-label">Full Name</div>
                  <p className="profile-field-value">{form.name ?? <span className="empty">Not provided</span>}</p>
                </div>
                <div className="profile-field">
                  <div className="profile-field-label">Email Address</div>
                  <p className="profile-field-value">{form.email ?? <span className="empty">Not provided</span>}</p>
                </div>
                <div className="profile-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="profile-field-label">Bio</div>
                  <p className="profile-field-value">{form.bio ?? <span className="empty">No bio added yet</span>}</p>
                </div>
                <div className="profile-field">
                  <div className="profile-field-label">Location</div>
                  <p className="profile-field-value">{form.location ?? <span className="empty">Not provided</span>}</p>
                </div>
                <div className="profile-field">
                  <div className="profile-field-label">Website</div>
                  <p className="profile-field-value">{form.website ?? <span className="empty">Not provided</span>}</p>
                </div>
              </div>
            ) : (
              <Form>
                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Label className="profile-field-label">Full Name</Form.Label>
                    <Form.Control
                      className="profile-form-control"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label className="profile-field-label">Email Address</Form.Label>
                    <Form.Control
                      className="profile-form-control"
                      name="email"
                      value={form.email}
                      disabled
                      title="Email cannot be changed"
                    />
                  </Col>
                  <Col md={12} className="mb-3">
                    <Form.Label className="profile-field-label">Bio</Form.Label>
                    <Form.Control
                      className="profile-form-control"
                      as="textarea"
                      rows={3}
                      name="bio"
                      value={form.bio}
                      onChange={handleChange}
                      placeholder="Tell us about yourself..."
                    />
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label className="profile-field-label">Location</Form.Label>
                    <Form.Control
                      className="profile-form-control"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="City, Country"
                    />
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label className="profile-field-label">Website</Form.Label>
                    <Form.Control
                      className="profile-form-control"
                      name="website"
                      value={form.website}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </Col>
                </Row>
              </Form>
            )}
          </div>
        </Card.Body>
      </Card>
      )}

      {activeTab === "bookmarks" && (
        <div className="profile-bookmarks">
          <h2 className="profile-name mb-3">Saved Threads</h2>
          {bookmarksLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" size="sm" />
              <p className="text-muted mt-2 mb-0">Loading saved threads...</p>
            </div>
          ) : savedThreads.length > 0 ? (
            <ThreadList threadsToDisplay={savedThreads} />
          ) : (
            <p className="text-muted text-center py-4">
              You haven't saved any threads yet.
            </p>
          )}
        </div>
      )}
    </Container>
  );
}

export default Profile;
