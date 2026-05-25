/**
 * @file mrf.h
 * @author David Dewhurst (david@drdewhurst.com)
 * @brief 
 * @version 0.1
 * @date 2024-01-13
 * 
 * @copyright Copyright (c) 2024, D R Dewhurst, Inc.
 * 
 */

#ifndef MRF_H
#define MRF_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief A nessage from node \f$i\f$ to node \f$j\f$.
 * 
 * Message \f$\mu_{ij}(x_j)\f$ has dimensions of the node to which it
 *  is sent.
 * 
 * A Message should be created using *only* new_message or associated
 *  constructors.
 * 
 */
struct Message {
    double * values;
    int from;
    int to;
    int dim;
};

/**
 * @brief A one-dimensional un-normalized mass function.
 * 
 * Each entry should satisfy \f$f_i(x_i)\geq 0\f$. 
 * 
 * A Factor1D should be created using *only* new_factor1d or associated
 *  constructors.
 * 
 */
struct Factor1D {
    double * values;
    int dim;
};

/**
 * @brief A two-dimensional un-normalized mass function.
 * 
 * Each entry should satisfy \f$f_{ij}(x_i, x_j) \geq 0 \f$.
 * 
 * A Factor2D should be created using *only* new_factor2d or associated
 *  constructors.
 * 
 */
struct Factor2D {
    double * values;
    int rows;
    int cols;
    int row_id;
    int col_id;
};

/**
 * @brief A variable node.
 * 
 * Variable nodes have a prior \f$f_i\f$, represented by a
 *  `struct Factor1D`, and an array of bivariate factors
 *  \f$f_{ij}(x_i, x_j)\f$ represented by `struct Factor2D`s. 
 * 
 * A Node should be created using *only* new_node or associated
 *  constructors.
 * 
 */
struct Node {
    int id;
    struct Node ** neighbors;
    struct Message ** inbox;
    struct Factor1D * factor1d;
    struct Factor2D ** factor2d;
    int degree;
    int dim;
    int connect_ix;
    int recv_ix;
};

// constructors and destructors

/**
 * @brief Create a new message that is not assigned to any node.
 * 
 * @param dim the dimension of the message
 * @return struct Message* 
 */
struct Message * new_message_unassigned(int dim);

/**
 * @brief Create a new message and assign it the specified origin and destination.
 * 
 * @param dim the dimension of the message
 * @param from the origin node
 * @param to the destination node
 * @return struct Message* 
 */
struct Message * new_message(int dim, int from, int to);

/**
 * @brief Delete the message.
 * 
 * @param msg the message to delete
 */
void delete_message(struct Message * msg);

/**
 * @brief Create a new node
 * 
 * @param id the identifier of the node
 * @param degree the number of neighbors the node will have
 * @param dim the dimensionality of the node
 * @return struct Node* 
 */
struct Node * new_node(int id, int degree, int dim);

/**
 * @brief Delete the node
 * 
 * @param node the node to delete
 */
void delete_node(struct Node * node);

/**
 * @brief Craete a new uninitialized Factor1D
 * 
 * @param dim the dimension of the factor; should correspond to a node's dimension
 * @return struct Factor1D* 
 */
struct Factor1D * new_factor1d(int dim);

/**
 * @brief Delete the Factor1D
 * 
 * @param fac the Factor1D to delete
 */
void delete_factor1d(struct Factor1D * fac);

/**
 * @brief Create a new uninitialized Factor2D. 
 * 
 * Factor2D is row-major.
 * 
 * @param rows the number of rows
 * @param cols the number of columns
 * @return struct Factor2D* 
 */
struct Factor2D * new_factor2d(int rows, int cols);

/**
 * @brief Delete the Factor2D
 * 
 * @param fac the Factor2D to delete
 */
void delete_factor2d(struct Factor2D * fac);

// distributions

/**
 * @brief Create a Factor1D with entries \f$f_i(x_i) = 1/dim\f$.
 * 
 * @param dim Dimensionality of the factor
 * @return struct Factor1D* 
 */
struct Factor1D * new_factor1d_uniform_prior(int dim);
/**
 * @brief Create a Factor2D with entries \f$f_{ij}(x_i, x_j) = (rows * cols)^{-1}\f$.
 * 
 * @param rows Number of rows the factor has
 * @param cols Number of columns the factor has
 * @return struct Factor2D* 
 */
struct Factor2D * new_factor2d_uniform_prior(int rows, int cols);

// indexing

/**
 * @brief Access the value in the message at the specified index
 * 
 * @param msg 
 * @param ix 
 * @return double 
 */
double message_at(struct Message * msg, int ix);
/**
 * @brief Set the value in the message at the specified index
 * 
 * @param msg 
 * @param ix 
 * @param value 
 */
void message_ix(struct Message * msg, int ix, double value);
/**
 * @brief Access the value in the factor at the specified index
 * 
 * @param fac 
 * @param ix 
 * @return double 
 */
double factor1d_at(struct Factor1D * fac, int ix);
/**
 * @brief Set the value in the factor at the specified index
 * 
 * @param fac 
 * @param ix 
 * @param value 
 */
void factor1d_ix(struct Factor1D * fac, int ix, double value);
/**
 * @brief Access the value in the factor at the specified row and column.
 * 
 * @param fac 
 * @param row 
 * @param col 
 * @return double 
 */
double factor2d_at(struct Factor2D * fac, int row, int col);
/**
 * @brief Set the value in the factor at the specified row and column
 * 
 * @param fac 
 * @param row 
 * @param col 
 * @param value 
 */
void factor2d_ix(struct Factor2D * fac, int row, int col, double value);

// graph structure

/**
 * @brief Connect two nodes with their joining bivariate factor.
 * 
 * @param n1 One of the nodes 
 * @param n2 The other node
 * @param fac The joint unnormalized mass function connecting them
 */
void connect_nodes(struct Node * n1, struct Node * n2, struct Factor2D * fac);

/**
 * @brief Connects a node with its prior.
 * 
 * @param n
 * @param fac 
 */
void connect_factor1d(struct Node * n, struct Factor1D * fac);

// message creation and manipulation

/**
 * @brief Create a new message with values \f$\mu_{ij}(x_i) = 1\f$.
 * 
 * @param dim
 * @param from
 * @param to
 * @return struct Message* 
 */
struct Message * new_message_unit(int dim, int from, int to);

/**
 * @brief Resets all messages in the node's inbox to one.
 * 
 * @param n the node for which to reset the messages.
 */
void reset_messages(struct Node * n);

/**
 * @brief Condition the variable to be equal to the value. 
 * 
 * Note that this modifies all factors associated with the node in place.
 * 
 * @param n the variable to condition
 * @param value variable set equal to this value.
 */
void set_evidence(struct Node * n, int value);

/**
 * @brief Computes the product of messages incoming to a node.
 * 
 * Computes the product of messages incoming to a node, with the exception of the message
 *  coming from the node to which the computed message will be going,
 *  In other words, computes \f$\prod_{k \in \partial i - j} \mu_{ki}(x_i)\f$.
 * 
 * @param from the node from which the message is coming
 * @param to the node to which the message is going
 * @param out_msg the message in which to store the result
 */
void message_product(struct Node * from, struct Node * to, struct Message * out_msg);

/**
 * @brief Computes the message from node i to node j.
 * 
 * Computes the value 
 *  \f$\mu_{ij}(x_j) = Z_{ij}^{-1} \sum_{x_i}f_i(x_i)f_{ij}(x_i, x_j) \prod_{k \in \partial i - j}\mu_{ki}(x_i)\f$,
 *  where \f$Z_{ij}\f$ is the normalizing constant.
 * 
 * @param from 
 * @param to 
 * @param out_msg 
 */
void compute_message(struct Node * from, struct Node * to, struct Message * out_msg);

/**
 * @brief Sends messages from the node to all of its neighbors.
 * 
 * @param from 
 */
void send_messages(struct Node * from);

/**
 * @brief Loopy belief propagation.
 * 
 * @param nodes The set of nodes for which to run BP. Probably should be all nodes in the MRF.
 * @param num_nodes The number of nodes.
 * @param num_iterations Number of iterations for which to run loopy bp.
 *  If the graph is a tree, set to 3 for analytical results.
 */
void bp(struct Node ** nodes, int num_nodes, int num_iterations);

/**
 * @brief Computes the univariate marginal probability distribution over the node's values.
 * 
 * Computes \f$p_i(x_i) = Z_i^{-1}f_i(x_i) \prod_{k \in \partial i}\mu_{ki}(x_i)\f$.
 * 
 * @param node The node for which to compute the probability distribution.
 * @param out The factor in which to store the result.
 */
void compute_univariate_marginal(struct Node * node, struct Factor1D * out);

#ifdef __cplusplus
}
#endif

#endif  // MRF_H