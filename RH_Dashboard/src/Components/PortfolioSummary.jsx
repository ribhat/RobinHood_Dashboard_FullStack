import React from "react";
import { Container, Row, Col, Dropdown } from "react-bootstrap";
import { Card } from "react-bootstrap";

const PortfolioSummary = ({
  equity,
  dividendsThisMonth,
  dividendsThisYear,
}) => {
  return (
    <Row className="mt-4">
      <Col md={4}>
        <Card>
          <Card.Body>
            <Card.Title>Portfolio Value</Card.Title>
            <Card.Text>${parseFloat(equity).toFixed(2)}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={4}>
        <Card>
          <Card.Body>
            <Card.Title>Dividends This Month</Card.Title>
            <Card.Text>${dividendsThisMonth.toFixed(2)}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={4}>
        <Card>
          <Card.Body>
            <Card.Title>Dividends This Year</Card.Title>
            <Card.Text>${dividendsThisYear.toFixed(2)}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default PortfolioSummary;
