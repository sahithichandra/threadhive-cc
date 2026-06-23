import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Card, Spinner } from 'react-bootstrap';
import { searchThreadsThunk } from '../../reducers/searchSlice';
import ThreadList from '../../components/ThreadList/ThreadList';

export default function SearchResults() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  const { results, loading, error } = useSelector((state) => state.search);

  useEffect(() => {
    if (query) {
      dispatch(searchThreadsThunk(query));
    }
  }, [dispatch, query]);

  return (
    <Container className="mt-3 mb-4">
      <Card className="border-0 rounded-3 shadow-sm">
        <Card.Body className="p-3 p-md-4">
          {!query ? (
            <p className="text-muted text-center py-4">
              Enter a search term to find threads.
            </p>
          ) : loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" size="sm" />
              <p className="text-muted mt-2 mb-0">Searching…</p>
            </div>
          ) : error ? (
            <p className="text-danger text-center py-4">Error: {error}</p>
          ) : (
            <>
              <h1 className="fs-4 fw-bold mb-3" style={{ color: 'var(--text-dark)' }}>
                Results for “{query}” — {results.length}{' '}
                {results.length === 1 ? 'thread' : 'threads'}
              </h1>
              {results.length > 0 ? (
                <ThreadList threadsToDisplay={results} />
              ) : (
                <p className="text-muted text-center py-4">
                  No threads found for “{query}”.
                </p>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
